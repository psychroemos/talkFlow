/* ============================================
   TALKFLOW — app.js (FINAL COMPLETE)
   Part 1 of 4: Data, Helpers, Tabs, Library
   ============================================ */

// ===== DATA STORE =====
var appData = {
    talks: [],
    settings: { fontSize: 'medium' }
};

// ===== STATE =====
var currentTalkId = null;
var editingTopicId = null;
var currentTopicIndex = 0;
var timerInterval = null;
var timerSeconds = 0;
var topicStartTime = 0;
var topicTimes = [];
var confirmCallback = null;
var activeLibraryFilter = 'all';

// ===== LOCAL STORAGE =====
function saveData() { localStorage.setItem('talkFlowData', JSON.stringify(appData)); }
function loadData() {
    var saved = localStorage.getItem('talkFlowData');
    if (saved) {
        var parsed = JSON.parse(saved);
        appData = Object.assign({}, appData, parsed);
        if (!appData.settings) appData.settings = { fontSize: 'medium' };
    }
}

// ===== HELPERS =====
function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }
function formatTime(s) { return String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0'); }
function formatMinutes(m) { return (m || 0) + ' min'; }
function getCurrentTalk() { return currentTalkId ? appData.talks.find(function(t){return t.id===currentTalkId}) : null; }
function getTotalTopicTime(talk) {
    var total = 0;
    if (talk && talk.topics) talk.topics.forEach(function(t){ total += parseInt(t.time)||0; });
    return total;
}
function getDateString() {
    var d = new Date();
    var m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return m[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

// ===== RICH TEXT HELPERS =====
function wrapSelectedText(textarea, before, after) {
    var start = textarea.selectionStart;
    var end = textarea.selectionEnd;
    var text = textarea.value;
    if (start === end) return;
    var selected = text.substring(start, end);
    var bCheck = text.substring(start - before.length, start);
    var aCheck = text.substring(end, end + after.length);
    if (bCheck === before && aCheck === after) {
        textarea.value = text.substring(0, start - before.length) + selected + text.substring(end + after.length);
        textarea.selectionStart = start - before.length;
        textarea.selectionEnd = end - before.length;
    } else {
        textarea.value = text.substring(0, start) + before + selected + after + text.substring(end);
        textarea.selectionStart = start + before.length;
        textarea.selectionEnd = end + before.length;
    }
    textarea.focus();
}

function renderRichText(text) {
    if (!text) return '';
    var s = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>\$1</strong>');
    s = s.replace(/__(.+?)__/g, '<span class="underline">\$1</span>');
    s = s.replace(/==(.+?)==/g, '<span class="highlight">\$1</span>');
    return s;
}

function handleTopicPointsKeydown(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    var ta = e.target;
    var start = ta.selectionStart;
    var text = ta.value;
    var insert = '\n\u2014 ';
    ta.value = text.substring(0, start) + insert + text.substring(start);
    ta.selectionStart = start + insert.length;
    ta.selectionEnd = start + insert.length;
}

// ===== CONFIRM DIALOG =====
function showConfirm(msg, cb) {
    document.getElementById('confirmMessage').textContent = msg;
    document.getElementById('confirmDialog').classList.remove('hidden');
    confirmCallback = cb;
}
function closeConfirm() {
    document.getElementById('confirmDialog').classList.add('hidden');
    confirmCallback = null;
}

// ===== TAB SWITCHING =====
function switchTab(tabName) {
    if (tabName === 'present') { startPresent(); return; }
    exitStage();
    document.querySelectorAll('.tab-page').forEach(function(p){p.classList.remove('active')});
    document.querySelectorAll('.tab-btn').forEach(function(b){b.classList.remove('active')});
    document.getElementById(tabName+'Tab').classList.add('active');
    document.querySelector('.tab-btn[data-tab="'+tabName+'"]').classList.add('active');
    if (tabName === 'talks') renderTalks();
    if (tabName === 'prepare') renderPrepare();
}

// ===== STAGE TRANSITIONS =====
function enterStage() {
    var bs = document.getElementById('backstage');
    var st = document.getElementById('stage');
    bs.classList.add('fade-out');
    setTimeout(function(){ st.classList.add('active'); }, 100);
}
function exitStage() {
    var bs = document.getElementById('backstage');
    var st = document.getElementById('stage');
    st.classList.remove('active');
    setTimeout(function(){ bs.classList.remove('fade-out'); }, 100);
    stopTimer();
}

// ===== TALKS TAB =====
function renderTalks() {
    var container = document.getElementById('talksList');
    var talks = appData.talks.slice();
    if (activeLibraryFilter !== 'all') talks = talks.filter(function(t){return t.category===activeLibraryFilter});
    talks.sort(function(a,b){ return (b.lastUsed||b.created||'').localeCompare(a.lastUsed||a.created||''); });

    if (talks.length === 0) {
        var msg = appData.talks.length === 0 ? 'No talks yet. Tap "+ New Talk" to create your first talk.' : 'No talks in this category.';
        container.innerHTML = '<div class="empty-state"><div class="empty-state-text">'+msg+'</div></div>';
        return;
    }

    container.innerHTML = talks.map(function(talk) {
        var bc = talk.category==='midweek'?'badge-midweek':'badge-public';
        var bl = talk.category==='midweek'?'Midweek':'Public Talk';
        var tc = talk.topics?talk.topics.length:0;
        var tt = getTotalTopicTime(talk);
        var lu = talk.lastUsed?'Last: '+talk.lastUsed:'Never used';
        return '<div class="talk-card">' +
            '<div class="talk-card-top" onclick="openTalk(\''+talk.id+'\')">' +
                '<span class="talk-card-title">'+talk.title+'</span>' +
                '<span class="talk-card-badge '+bc+'">'+bl+'</span></div>' +
            '<div class="talk-card-meta" onclick="openTalk(\''+talk.id+'\')">' +
                '<span>'+tc+' topics</span><span>'+formatMinutes(tt)+'</span><span>'+lu+'</span></div>' +
            '<div class="talk-card-actions">' +
                '<button class="talk-action-btn" onclick="event.stopPropagation();duplicateTalk(\''+talk.id+'\')">Duplicate</button>' +
                '<button class="talk-action-btn delete" onclick="event.stopPropagation();deleteTalk(\''+talk.id+'\')">Delete</button></div></div>';
    }).join('');
}

function openTalk(id) { currentTalkId = id; switchTab('prepare'); }

function duplicateTalk(id) {
    var o = appData.talks.find(function(t){return t.id===id});
    if (!o) return;
    var c = JSON.parse(JSON.stringify(o));
    c.id = generateId(); c.title = o.title+' (Copy)'; c.created = getDateString(); c.lastUsed = null; c.reviews = [];
    if (c.topics) c.topics.forEach(function(t){t.id=generateId()});
    appData.talks.push(c); saveData(); renderTalks();
}

function deleteTalk(id) {
    var t = appData.talks.find(function(x){return x.id===id});
    if (!t) return;
    showConfirm('Delete "'+t.title+'"?', function(){
        appData.talks = appData.talks.filter(function(x){return x.id!==id});
        if (currentTalkId===id) currentTalkId = null;
        saveData(); renderTalks();
    });
}

// ===== NEW TALK PANEL =====
function openNewTalkPanel() {
    document.getElementById('newTalkTitle').value = '';
    document.getElementById('newTalkCategory').value = 'midweek';
    document.getElementById('newTalkTime').value = '';
    document.getElementById('newTalkPanel').classList.add('open');
    document.getElementById('newTalkOverlay').classList.add('open');
}
function closeNewTalkPanel() {
    document.getElementById('newTalkPanel').classList.remove('open');
    document.getElementById('newTalkOverlay').classList.remove('open');
}
function createTalk() {
    var title = document.getElementById('newTalkTitle').value.trim();
    if (!title) { alert('Enter a talk title.'); return; }
    var cat = document.getElementById('newTalkCategory').value;
    var time = parseInt(document.getElementById('newTalkTime').value) || 30;
    var talk = {
        id: generateId(), title: title, category: cat, targetTime: time,
        topics: [{ id: generateId(), title: 'Pambungad', points: '', time: 2 }],
        created: getDateString(), lastUsed: null, reviews: []
    };
    appData.talks.push(talk); saveData(); closeNewTalkPanel();
    currentTalkId = talk.id; switchTab('prepare');
}

/* ============================================
   TALKFLOW — app.js (FINAL COMPLETE)
   Part 2 of 4: Prepare Tab (Talk Builder)
   ============================================ */

// ===== PREPARE TAB =====
function renderPrepare() {
    var talk = getCurrentTalk();
    var tab = document.getElementById('prepareTab');

    if (!talk) {
        tab.querySelectorAll('.prepare-header,.section-label,.topic-list,.btn-add-topic,.prepare-actions').forEach(function(el){el.style.display='none'});
        var empty = document.getElementById('prepareEmpty');
        if (!empty) {
            empty = document.createElement('div');
            empty.id = 'prepareEmpty';
            empty.className = 'empty-state';
            empty.innerHTML = '<div class="empty-state-text">Select a talk from the library first.</div>';
            tab.appendChild(empty);
        }
        empty.style.display = '';
        return;
    }

    var empty = document.getElementById('prepareEmpty');
    if (empty) empty.style.display = 'none';
    tab.querySelectorAll('.prepare-header,.section-label,.topic-list,.btn-add-topic,.prepare-actions').forEach(function(el){el.style.display=''});

    document.getElementById('talkTitle').value = talk.title;
    document.getElementById('talkCategory').value = talk.category;
    document.getElementById('talkTargetTime').value = talk.targetTime || '';

    updateTimeSummary();
    renderTopicList();
}

function updateTimeSummary() {
    var talk = getCurrentTalk();
    if (!talk) return;
    var el = document.getElementById('timeSummary');
    var total = getTotalTopicTime(talk);
    var target = parseInt(talk.targetTime) || 0;

    if (target <= 0 || total <= 0) { el.textContent = ''; el.className = 'time-summary'; return; }

    var diff = total - target;
    if (diff === 0) {
        el.textContent = total+'/'+target+' min \u2014 Perfect!';
        el.className = 'time-summary on-track';
    } else if (diff > 0) {
        el.textContent = total+'/'+target+' min \u2014 '+diff+' min over';
        el.className = 'time-summary over';
    } else {
        el.textContent = total+'/'+target+' min \u2014 '+Math.abs(diff)+' min left';
        el.className = 'time-summary under';
    }
}

function renderTopicList() {
    var talk = getCurrentTalk();
    if (!talk) return;
    var container = document.getElementById('topicList');

    if (!talk.topics || talk.topics.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-text">No topics yet. Tap "+ Add Topic" below.</div></div>';
        return;
    }

    container.innerHTML = talk.topics.map(function(topic, idx) {
        var preview = '';
        if (topic.points) {
            var lines = topic.points.split('\n').filter(function(l){return l.trim()});
            preview = lines.slice(0,2).join(' \u00b7 ');
            if (lines.length > 2) preview += ' \u2026';
        }
        return '<div class="topic-card" onclick="openTopicPanel(\''+topic.id+'\')">' +
            '<span class="topic-number">'+(idx+1)+'</span>' +
            '<div class="topic-card-info">' +
                '<span class="topic-card-title">'+topic.title+'</span>' +
                (preview ? '<span class="topic-card-preview">'+preview+'</span>' : '') +
            '</div>' +
            '<span class="topic-card-time">'+formatMinutes(topic.time)+'</span></div>';
    }).join('');
}

function savePrepareHeader() {
    var talk = getCurrentTalk();
    if (!talk) return;
    var title = document.getElementById('talkTitle').value.trim();
    if (title) talk.title = title;
    talk.category = document.getElementById('talkCategory').value;
    talk.targetTime = parseInt(document.getElementById('talkTargetTime').value) || 0;
    saveData();
    updateTimeSummary();
}

// ===== TOPIC PANEL =====
function openTopicPanel(topicId) {
    var talk = getCurrentTalk();
    if (!talk) return;
    editingTopicId = topicId || null;
    var panel = document.getElementById('topicPanel');
    var overlay = document.getElementById('topicPanelOverlay');

    if (topicId) {
        var topic = talk.topics.find(function(t){return t.id===topicId});
        if (!topic) return;
        document.getElementById('topicPanelTitle').textContent = 'Edit Topic';
        document.getElementById('topicTitle').value = topic.title;
        document.getElementById('topicPoints').value = topic.points || '';
        document.getElementById('topicTime').value = topic.time || '';
        document.getElementById('deleteTopicBtn').classList.remove('hidden');
    } else {
        document.getElementById('topicPanelTitle').textContent = 'Add Topic';
        document.getElementById('topicTitle').value = '';
        document.getElementById('topicPoints').value = '';
        document.getElementById('topicTime').value = '';
        document.getElementById('deleteTopicBtn').classList.add('hidden');
    }

    panel.classList.add('open');
    overlay.classList.add('open');
    document.getElementById('topicTitle').focus();
}

function closeTopicPanel() {
    document.getElementById('topicPanel').classList.remove('open');
    document.getElementById('topicPanelOverlay').classList.remove('open');
    editingTopicId = null;
}

function saveTopic() {
    var talk = getCurrentTalk();
    if (!talk) return;
    var title = document.getElementById('topicTitle').value.trim();
    if (!title) { alert('Enter a topic title.'); return; }
    var points = document.getElementById('topicPoints').value;
    var time = parseInt(document.getElementById('topicTime').value) || 0;
    if (!talk.topics) talk.topics = [];

    if (editingTopicId) {
        var topic = talk.topics.find(function(t){return t.id===editingTopicId});
        if (topic) { topic.title = title; topic.points = points; topic.time = time; }
    } else {
        talk.topics.push({ id: generateId(), title: title, points: points, time: time });
    }
    saveData(); closeTopicPanel(); renderTopicList(); updateTimeSummary();
}

function deleteTopic() {
    if (!editingTopicId) return;
    var talk = getCurrentTalk();
    if (!talk) return;
    var topic = talk.topics.find(function(t){return t.id===editingTopicId});
    if (!topic) return;
    showConfirm('Delete "'+topic.title+'"?', function(){
        talk.topics = talk.topics.filter(function(t){return t.id!==editingTopicId});
        saveData(); closeTopicPanel(); renderTopicList(); updateTimeSummary();
    });
}

/* ============================================
   TALKFLOW — app.js (FINAL COMPLETE)
   Part 3 of 4: Present Mode (Live Speaking)
   ============================================ */

// ===== START PRESENT =====
function startPresent() {
    var talk = getCurrentTalk();
    if (!talk) { alert('Select a talk first.'); return; }
    if (!talk.topics || talk.topics.length === 0) { alert('Add at least one topic before starting.'); return; }

    currentTopicIndex = 0;
    timerSeconds = 0;
    topicStartTime = 0;
    topicTimes = talk.topics.map(function(){ return 0; });

    talk.lastUsed = getDateString();
    saveData();

    var targetMins = parseInt(talk.targetTime) || 0;
    document.getElementById('timerTarget').textContent = formatTime(targetMins * 60);
    document.getElementById('timerCurrent').textContent = '00:00';
    document.getElementById('progressFill').style.width = '0%';

    enterStage();
    requestWakeLock();
    startTimer();
    renderPresent();

    // Scroll to top
    var scroll = document.querySelector('.stage-main-scroll');
    if (scroll) scroll.scrollTop = 0;
}

// ===== TIMER =====
function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(function(){ timerSeconds++; updateTimerDisplay(); }, 1000);
}
function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    releaseWakeLock();
}

function updateTimerDisplay() {
    var talk = getCurrentTalk();
    if (!talk) return;
    var el = document.getElementById('timerCurrent');
    el.textContent = formatTime(timerSeconds);
    var target = (parseInt(talk.targetTime)||0) * 60;
    var pct = target > 0 ? (timerSeconds/target)*100 : 0;

    el.className = 'timer-current';
    if (target > 0) {
        if (timerSeconds > target) el.classList.add('overtime');
        else if (timerSeconds > target * 0.85) el.classList.add('warning');
        else el.classList.add('on-time');
    } else {
        el.classList.add('on-time');
    }

    document.getElementById('progressFill').style.width = Math.min(pct,100) + '%';
    updateTopicTimeDisplay();
}

function updateTopicTimeDisplay() {
    var talk = getCurrentTalk();
    if (!talk || !talk.topics[currentTopicIndex]) return;
    var elapsed = timerSeconds - topicStartTime;
    var suggested = (parseInt(talk.topics[currentTopicIndex].time)||0) * 60;
    var el = document.getElementById('presentTopicTime');

    if (suggested <= 0) {
        el.textContent = formatTime(elapsed) + ' elapsed';
        el.className = 'stage-topic-time';
        return;
    }
    el.textContent = formatTime(elapsed) + ' / ' + formatTime(suggested);
    if (elapsed > suggested) el.className = 'stage-topic-time overtime';
    else if (elapsed > suggested * 0.8) el.className = 'stage-topic-time warning';
    else el.className = 'stage-topic-time on-time';
}

// ===== RENDER PRESENT =====
function renderPresent() {
    var talk = getCurrentTalk();
    if (!talk || !talk.topics) return;
    var fs = appData.settings.fontSize || 'medium';
    var topic = talk.topics[currentTopicIndex];

    // Step
    document.getElementById('presentStep').textContent = (currentTopicIndex+1) + ' of ' + talk.topics.length;

    // Title
    var titleEl = document.getElementById('presentTitle');
    titleEl.textContent = topic ? topic.title : '';
    titleEl.className = 'stage-card-title font-' + fs;

    // Points with rich text and dividers
    var pointsEl = document.getElementById('presentPoints');
    if (topic && topic.points) {
        var lines = topic.points.split('\n');
        var html = '';
        lines.forEach(function(line) {
            var trimmed = line.trim();
            if (trimmed === '') {
                // Blank line = visual divider
                html += '<div class="stage-point-divider"></div>';
            } else {
                html += '<div class="stage-point font-' + fs + '">' + renderRichText(trimmed) + '</div>';
            }
        });
        pointsEl.innerHTML = html;
    } else {
        pointsEl.innerHTML = '';
    }

    // Next preview
    var nextEl = document.getElementById('presentNext');
    if (currentTopicIndex < talk.topics.length - 1) {
        var next = talk.topics[currentTopicIndex + 1];
        nextEl.textContent = 'Next: ' + (currentTopicIndex+2) + '. ' + next.title;
    } else {
        nextEl.textContent = 'Last topic';
    }

    // Done button
    var doneBtn = document.getElementById('doneTopicBtn');
    doneBtn.textContent = currentTopicIndex >= talk.topics.length - 1 ? 'Finish Talk \u2713' : 'Tapos na \u2713';

    // Sidebar
    renderStageSidebar();
    updateTopicTimeDisplay();

    // Scroll to top of content
    var scroll = document.querySelector('.stage-main-scroll');
    if (scroll) scroll.scrollTop = 0;
}

function renderStageSidebar() {
    var talk = getCurrentTalk();
    if (!talk || !talk.topics) return;
    var container = document.getElementById('presentTopicList');

    container.innerHTML = talk.topics.map(function(topic, idx) {
        var cls = 'stage-sidebar-item';
        var check = '';
        if (idx < currentTopicIndex) {
            cls += ' done';
            check = '\u2713';
        } else if (idx === currentTopicIndex) {
            cls += ' current';
            check = '\u25B6';
        } else {
            check = String(idx + 1);
        }
        return '<div class="'+cls+'" onclick="jumpToTopic('+idx+')">' +
            '<span class="sidebar-check">'+check+'</span>' +
            '<span>'+topic.title+'</span></div>';
    }).join('');
}

// ===== NAVIGATION =====
function markTopicDone() {
    var talk = getCurrentTalk();
    if (!talk || !talk.topics) return;
    topicTimes[currentTopicIndex] = timerSeconds - topicStartTime;
    if (currentTopicIndex >= talk.topics.length - 1) { endTalk(); return; }
    currentTopicIndex++;
    topicStartTime = timerSeconds;
    renderPresent();
}

function goToPrevTopic() {
    if (currentTopicIndex <= 0) return;
    topicTimes[currentTopicIndex] = timerSeconds - topicStartTime;
    currentTopicIndex--;
    topicStartTime = timerSeconds;
    renderPresent();
}

function goToNextTopic() {
    var talk = getCurrentTalk();
    if (!talk || currentTopicIndex >= talk.topics.length - 1) return;
    topicTimes[currentTopicIndex] = timerSeconds - topicStartTime;
    currentTopicIndex++;
    topicStartTime = timerSeconds;
    renderPresent();
}

function jumpToTopic(idx) {
    var talk = getCurrentTalk();
    if (!talk || idx < 0 || idx >= talk.topics.length) return;
    topicTimes[currentTopicIndex] = timerSeconds - topicStartTime;
    currentTopicIndex = idx;
    topicStartTime = timerSeconds;
    renderPresent();
}

// ===== END TALK =====
function endTalk() {
    topicTimes[currentTopicIndex] = timerSeconds - topicStartTime;
    stopTimer();
    exitStage();
    setTimeout(function(){ showReview(); }, 600);
}

function confirmEndTalk() {
    showConfirm('End this talk now?', function(){
        topicTimes[currentTopicIndex] = timerSeconds - topicStartTime;
        stopTimer();
        exitStage();
        setTimeout(function(){ showReview(); }, 600);
    });
}

// ===== WAKE LOCK =====
var wakeLock = null;
function requestWakeLock() {
    if ('wakeLock' in navigator) {
        navigator.wakeLock.request('screen').then(function(l){ wakeLock=l; }).catch(function(){});
    }
}
function releaseWakeLock() {
    if (wakeLock) { wakeLock.release().then(function(){ wakeLock=null; }).catch(function(){}); }
}

// ===== REVIEW =====
function showReview() {
    var talk = getCurrentTalk();
    if (!talk) return;
    var target = (parseInt(talk.targetTime)||0) * 60;
    var diff = timerSeconds - target;
    var vc = 'good'; var vt = 'Right on time!';
    if (target > 0) {
        if (diff > 60) { vc='over'; vt=Math.floor(diff/60)+' min '+(diff%60)+' sec over target'; }
        else if (diff < -60) { vc='under'; vt=Math.floor(Math.abs(diff)/60)+' min '+(Math.abs(diff)%60)+' sec under target'; }
    }

    document.getElementById('reviewSummary').innerHTML =
        '<div class="review-total-time">'+formatTime(timerSeconds)+'</div>' +
        '<div class="review-target">Target: '+formatTime(target)+'</div>' +
        '<div class="review-verdict '+vc+'">'+vt+'</div>';

    document.getElementById('reviewTopics').innerHTML = talk.topics.map(function(topic, idx) {
        var actual = topicTimes[idx] || 0;
        var suggested = (parseInt(topic.time)||0) * 60;
        var ac = 'on-time';
        if (suggested > 0 && actual > suggested * 1.1) ac = 'over';
        return '<div class="review-topic-row">' +
            '<span class="review-topic-name">'+(idx+1)+'. '+topic.title+'</span>' +
            '<div class="review-topic-times">' +
                '<span class="review-actual '+ac+'">'+formatTime(actual)+'</span>' +
                '<span class="review-suggested">/ '+formatTime(suggested)+'</span></div></div>';
    }).join('');

    document.getElementById('reviewNotes').value = '';
    document.getElementById('reviewPanel').classList.add('open');
    document.getElementById('reviewOverlay').classList.add('open');
}

function closeReview() {
    document.getElementById('reviewPanel').classList.remove('open');
    document.getElementById('reviewOverlay').classList.remove('open');
}

function saveReview() {
    var talk = getCurrentTalk();
    if (!talk) { closeReview(); return; }
    var notes = document.getElementById('reviewNotes').value.trim();
    if (!talk.reviews) talk.reviews = [];
    talk.reviews.push({
        date: getDateString(),
        totalTime: timerSeconds,
        targetTime: (parseInt(talk.targetTime)||0)*60,
        topicTimes: topicTimes.slice(),
        notes: notes
    });
    saveData(); closeReview(); renderTalks();
}

/* ============================================
   TALKFLOW — app.js (FINAL COMPLETE)
   Part 4 of 4: Settings, Export/Import, Init
   ============================================ */

// ===== SETTINGS =====
function openSettings() {
    document.getElementById('fontSizeSelect').value = appData.settings.fontSize || 'medium';
    document.getElementById('settingsModal').classList.remove('hidden');
}
function closeSettings() {
    appData.settings.fontSize = document.getElementById('fontSizeSelect').value;
    saveData();
    document.getElementById('settingsModal').classList.add('hidden');
}

// ===== EXPORT =====
function exportJson() {
    var str = JSON.stringify(appData, null, 2);
    var blob = new Blob([str], {type:'application/json'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'talkflow-backup-' + getDateString().replace(/[, ]/g,'-') + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ===== IMPORT =====
function importJson() { document.getElementById('importFileInput').click(); }
function handleImportFile(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
        try {
            var imported = JSON.parse(ev.target.result);
            if (!imported.talks || !Array.isArray(imported.talks)) { alert('Invalid file.'); return; }
            showConfirm('Restore data from backup?', function(){
                appData = Object.assign({}, appData, imported);
                if (!appData.settings) appData.settings = {fontSize:'medium'};
                saveData(); renderTalks();
            });
        } catch(err) { alert('Error reading file.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
}

// ===== KEYBOARD =====
function handleKeyboard(e) {
    var stage = document.getElementById('stage');
    if (!stage.classList.contains('active')) return;
    switch(e.key) {
        case 'ArrowRight': case ' ': e.preventDefault(); markTopicDone(); break;
        case 'ArrowLeft': e.preventDefault(); goToPrevTopic(); break;
        case 'Escape': e.preventDefault(); confirmEndTalk(); break;
    }
}

// ===== SWIPE =====
var touchStartX = 0;
var touchStartY = 0;
function handleTouchStart(e) {
    var stage = document.getElementById('stage');
    if (!stage.classList.contains('active')) return;
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}
function handleTouchEnd(e) {
    var stage = document.getElementById('stage');
    if (!stage.classList.contains('active')) return;
    var dx = e.changedTouches[0].screenX - touchStartX;
    var dy = e.changedTouches[0].screenY - touchStartY;
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
    if (dx < 0) markTopicDone(); else goToPrevTopic();
}

// ===== MASTER INIT =====
function initApp() {
    loadData();

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(function(btn){
        btn.addEventListener('click', function(){ switchTab(btn.dataset.tab); });
    });

    // Library filter
    document.querySelectorAll('[data-catfilter]').forEach(function(btn){
        btn.addEventListener('click', function(){
            document.querySelectorAll('[data-catfilter]').forEach(function(b){b.classList.remove('active')});
            btn.classList.add('active');
            activeLibraryFilter = btn.dataset.catfilter;
            renderTalks();
        });
    });

    // New talk
    document.getElementById('newTalkBtn').addEventListener('click', openNewTalkPanel);
    document.getElementById('newTalkClose').addEventListener('click', closeNewTalkPanel);
    document.getElementById('newTalkOverlay').addEventListener('click', closeNewTalkPanel);
    document.getElementById('createTalkBtn').addEventListener('click', createTalk);

    // Prepare header
    document.getElementById('talkTitle').addEventListener('blur', savePrepareHeader);
    document.getElementById('talkCategory').addEventListener('change', savePrepareHeader);
    document.getElementById('talkTargetTime').addEventListener('blur', savePrepareHeader);
    document.getElementById('prepareBackBtn').addEventListener('click', function(){
        savePrepareHeader(); switchTab('talks');
    });

    // Topics
    document.getElementById('addTopicBtn').addEventListener('click', function(){ openTopicPanel(null); });
    document.getElementById('topicPanelClose').addEventListener('click', closeTopicPanel);
    document.getElementById('topicPanelOverlay').addEventListener('click', closeTopicPanel);
    document.getElementById('saveTopicBtn').addEventListener('click', saveTopic);
    document.getElementById('deleteTopicBtn').addEventListener('click', deleteTopic);

    // Rich text toolbar
    document.getElementById('richBold').addEventListener('click', function(){
        wrapSelectedText(document.getElementById('topicPoints'), '**', '**');
    });
    document.getElementById('richUnderline').addEventListener('click', function(){
        wrapSelectedText(document.getElementById('topicPoints'), '__', '__');
    });
    document.getElementById('richHighlight').addEventListener('click', function(){
        wrapSelectedText(document.getElementById('topicPoints'), '==', '==');
    });
    document.getElementById('topicPoints').addEventListener('keydown', handleTopicPointsKeydown);

    // Start talk
    document.getElementById('startPresentBtn').addEventListener('click', startPresent);

    // Stage controls
    document.getElementById('doneTopicBtn').addEventListener('click', markTopicDone);
    document.getElementById('endTalkBtn').addEventListener('click', confirmEndTalk);
    document.getElementById('prevTopicBtn').addEventListener('click', goToPrevTopic);
    document.getElementById('nextTopicBtn').addEventListener('click', goToNextTopic);

    // Review
    document.getElementById('reviewCloseBtn').addEventListener('click', closeReview);
    document.getElementById('reviewOverlay').addEventListener('click', closeReview);
    document.getElementById('saveReviewBtn').addEventListener('click', saveReview);

    // Settings
    document.getElementById('settingsBtn').addEventListener('click', openSettings);
    document.getElementById('settingsCloseBtn').addEventListener('click', closeSettings);

    // Export/Import
    document.getElementById('exportJsonBtn').addEventListener('click', exportJson);
    document.getElementById('importJsonBtn').addEventListener('click', importJson);
    document.getElementById('importFileInput').addEventListener('change', handleImportFile);

    // Confirm
    document.getElementById('confirmYesBtn').addEventListener('click', function(){
        if (confirmCallback) confirmCallback();
        closeConfirm();
    });
    document.getElementById('confirmNoBtn').addEventListener('click', closeConfirm);

    // Keyboard + Swipe
    document.addEventListener('keydown', handleKeyboard);
    document.addEventListener('touchstart', handleTouchStart, {passive:true});
    document.addEventListener('touchend', handleTouchEnd, {passive:true});

    // Initial render
    renderTalks();
}

// ===== START =====
document.addEventListener('DOMContentLoaded', initApp);