

let currentPage = 'dashboard';
let instructorsCache = [];
let roomsCache = [];
let subjectsCache = [];
let departmentsCache = [];

auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'admin') {
        await auth.signOut();
        window.location.href = 'index.html';
        return;
    }

    
    document.getElementById('adminName').textContent = userDoc.data().fullName || 'Admin';
    document.getElementById('adminEmail').textContent = user.email;

    
    document.getElementById('currentDate').textContent = formatDate(new Date());

    
    loadDashboard();
    loadInstructors();
    loadRooms();
    loadSubjects();
    loadDepartments();
    loadSchedules();

    
    listenToFirestoreNotifications();
    refreshCheckerBadge();
    refreshAttendanceBadge();

    
    setTimeout(startMissedCheckMonitor, 3000);
});

document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', () => {
        const page = item.dataset.page;
        navigateTo(page);
    });
});

function navigateTo(page) {
    
    document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
    document.querySelector(`.menu-item[data-page="${page}"]`).classList.add('active');

    
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');

    
    const titles = {
        dashboard: 'Dashboard',
        attendance: 'Attendance Logs',
        instructors: 'Instructors',
        rooms: 'Rooms',
        schedules: 'Schedules',
        subjects: 'Subjects',
        departments: 'Departments',
        checkers: 'Checkers',
        reports: 'Reports',
        calendar: 'Calendar'
    };
    document.getElementById('pageTitle').textContent = titles[page] || page;

    currentPage = page;

    const searchInput = document.getElementById('topbarSearch');
    if (searchInput) searchInput.value = '';

    
    document.getElementById('sidebar').classList.remove('open');

    
    if (page === 'attendance') {
        clearAttendanceBadge();
        loadAttendanceLogs();
    }
    if (page === 'checkers') {
        clearCheckerBadge();
        loadCheckers();
        renderCheckerUpdates(window.correctionNotifications || []);
        loadTodayCheckerActivity();
    }
    if (page === 'reports') populateReportInstructors();
    if (page === 'calendar') loadCalendar();
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

function handleGlobalSearch(query) {
    query = query.toLowerCase().trim();
    const activePage = document.querySelector('.page.active');
    if (!activePage) return;

    const pageId = activePage.id;
    if (pageId === 'page-schedules') {
        const cards = document.querySelectorAll('.schedules-grouped .sched-instructor-card');
        cards.forEach(card => {
            const name = card.querySelector('.sched-instructor-name')?.textContent.toLowerCase() || '';
            const dept = card.querySelector('.sched-instructor-dept')?.textContent.toLowerCase() || '';
            const subjects = [...card.querySelectorAll('.sched-table tbody tr')].map(tr => tr.querySelector('td strong')?.textContent.toLowerCase() || '');
            const matchSubject = subjects.some(s => s.includes(query));
            if (name.includes(query) || dept.includes(query) || matchSubject) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    } else if (pageId === 'page-instructors') {
        const rows = document.querySelectorAll('#instructorsTable tr');
        rows.forEach(row => {
            const name = row.querySelector('td:nth-child(2)')?.textContent.toLowerCase() || '';
            const dept = row.querySelector('td:nth-child(3)')?.textContent.toLowerCase() || '';
            const email = row.querySelector('td:nth-child(4)')?.textContent.toLowerCase() || '';
            const type = row.querySelector('td:nth-child(5)')?.textContent.toLowerCase() || '';
            if (name.includes(query) || dept.includes(query) || email.includes(query) || type.includes(query)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    } else if (pageId === 'page-rooms') {
        const rows = document.querySelectorAll('#roomsTable tr');
        rows.forEach(row => {
            const name = row.querySelector('td:nth-child(1)')?.textContent.toLowerCase() || '';
            const building = row.querySelector('td:nth-child(2)')?.textContent.toLowerCase() || '';
            if (name.includes(query) || building.includes(query)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    } else if (pageId === 'page-subjects') {
        const rows = document.querySelectorAll('#subjectsTable tr');
        rows.forEach(row => {
            const code = row.querySelector('td:nth-child(1)')?.textContent.toLowerCase() || '';
            const name = row.querySelector('td:nth-child(2)')?.textContent.toLowerCase() || '';
            if (code.includes(query) || name.includes(query)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    } else if (pageId === 'page-checkers') {
        const rows = document.querySelectorAll('#checkersTable tr');
        rows.forEach(row => {
            const name = row.querySelector('td:nth-child(2)')?.textContent.toLowerCase() || '';
            const email = row.querySelector('td:nth-child(3)')?.textContent.toLowerCase() || '';
            if (name.includes(query) || email.includes(query)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    } else if (pageId === 'page-dashboard') {
        const rows = document.querySelectorAll('#dashboardAttendanceTable tr');
        rows.forEach(row => {
            const name = row.querySelector('td:nth-child(2)')?.textContent.toLowerCase() || '';
            const room = row.querySelector('td:nth-child(3)')?.textContent.toLowerCase() || '';
            const schedule = row.querySelector('td:nth-child(4)')?.textContent.toLowerCase() || '';
            const remarks = row.querySelector('td:nth-child(6)')?.textContent.toLowerCase() || '';
            if (name.includes(query) || room.includes(query) || schedule.includes(query) || remarks.includes(query)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }
}

function showInstructorProfile(id) {
    const inst = instructorsCache.find(i => i.id === id);
    if (!inst) return;

    
    document.getElementById('profAvatar').textContent = inst.name.charAt(0).toUpperCase();
    document.getElementById('profName').textContent = inst.name;
    document.getElementById('profDept').textContent = inst.department || 'N/A';
    document.getElementById('profEmail').textContent = inst.email || 'No email provided';
    document.getElementById('profType').textContent = inst.type || 'Full-time';
    
    const statusEl = document.getElementById('profStatus');
    const isActive = inst.isActive !== false;
    statusEl.textContent = isActive ? 'Active' : 'Inactive';
    statusEl.className = `status-pill ${isActive ? 'status-active' : 'status-inactive'}`;

    
    const schedules = schedulesCache.filter(s => s.instructorId === id);
    const container = document.getElementById('profSchedules');
    
    if (schedules.length === 0) {
        container.innerHTML = '<div class="profile-no-schedules"><span class="material-icons" style="font-size:32px;color:#ccc;display:block;margin-bottom:8px;">event_busy</span>No schedule commitments found</div>';
    } else {
        
        const dayOrder = ['Everyday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
        const grouped = {};
        schedules.forEach(s => {
            if (!grouped[s.dayOfWeek]) grouped[s.dayOfWeek] = [];
            grouped[s.dayOfWeek].push(s);
        });

        const sortedDays = Object.keys(grouped).sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));

        container.innerHTML = sortedDays.map(day => {
            const list = grouped[day];
            list.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
            const entriesHtml = list.map(s => {
                const roomName = roomsCache.find(r => r.id === s.roomId)?.name || s.roomId;
                return `
                    <div class="profile-item-entry">
                        <div class="profile-item-info">
                            <span class="profile-item-subject">${s.subject}${s.course ? ` (${s.course})` : ''}</span>
                            <span class="profile-item-room">${roomName}</span>
                        </div>
                        <span class="profile-item-time">${formatTime12(s.startTime)} - ${formatTime12(s.endTime)}</span>
                    </div>
                `;
            }).join('');

            return `
                <div class="profile-day-group">
                    <div class="profile-day-title">${day}</div>
                    <div class="profile-day-entries">${entriesHtml}</div>
                </div>
            `;
        }).join('');
    }

    openModal('instructorInfoModal');
}

let missedCheckInterval = null;
const readNotifKeys = new Set(JSON.parse(localStorage.getItem('readNotifKeys') || '[]'));

function formatTime12(t) {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function startMissedCheckMonitor() {
    
    checkMissedSchedules();
    if (missedCheckInterval) clearInterval(missedCheckInterval);
    missedCheckInterval = setInterval(checkMissedSchedules, 60000);
    
    
    listenToFirestoreNotifications();
}

async function checkMissedSchedules() {
    try {
        const now = new Date();
        const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const todayName = days[now.getDay()];

        
        const schedSnap = await db.collection('schedules').where('isActive', '==', true).get();
        const todaySchedules = [];
        schedSnap.forEach(doc => {
            const s = doc.data();
            s.id = doc.id;
            if (s.dayOfWeek === todayName || s.dayOfWeek === 'Everyday') {
                todaySchedules.push(s);
            }
        });

        if (todaySchedules.length === 0) {
            updateNotifUI([], true);  
            updateScheduleBanner(0, 0, 0, true);
            return;
        }

        
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(startOfDay);
        endOfDay.setDate(endOfDay.getDate() + 1);

        const attSnap = await db.collection('attendance')
            .where('dateTime', '>=', startOfDay)
            .where('dateTime', '<', endOfDay)
            .get();

        const checkedSet = new Set();
        attSnap.forEach(doc => {
            const d = doc.data();
            
            checkedSet.add(d.instructorId + '|' + (d.subjectSchedule || '').split(' (')[0]);
        });

        
        const missed = [];
        let passedCount = 0;
        let checkedCount = 0;
        todaySchedules.forEach(s => {
            
            const [eh, em] = (s.endTime || '00:00').split(':').map(Number);
            const schedEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), eh, em);

            
            if (now > schedEnd) {
                passedCount++;
                const key = s.instructorId + '|' + (s.subject || '');
                if (!checkedSet.has(key)) {
                    const instName = instructorsCache.find(i => i.id === s.instructorId)?.name || s.instructorId;
                    const roomName = roomsCache.find(r => r.id === s.roomId)?.name || s.roomId;
                    missed.push({
                        instructorName: instName,
                        subject: s.subject || '',
                        room: roomName,
                        startTime: s.startTime || '',
                        endTime: s.endTime || '',
                        dayOfWeek: s.dayOfWeek
                    });
                } else {
                    checkedCount++;
                }
            }
        });

        updateNotifUI(missed, false);
        updateScheduleBanner(todaySchedules.length, checkedCount, missed.length, false);
    } catch (err) {
        console.error('Missed check monitor error:', err);
    }
}

function updateScheduleBanner(totalSchedules, checked, missed, noClasses) {
    const banner = document.getElementById('scheduleStatusBanner');
    const icon = document.getElementById('bannerIcon');
    const title = document.getElementById('bannerTitle');
    const subtitle = document.getElementById('bannerSubtitle');
    banner.style.display = 'flex';
    banner.className = 'schedule-status-banner';

    if (noClasses) {
        banner.classList.add('banner-none');
        icon.textContent = 'event_busy';
        title.textContent = 'No Classes Today';
        subtitle.textContent = 'No schedules are assigned for today.';
    } else if (missed > 0) {
        banner.classList.add('banner-warn');
        icon.textContent = 'warning';
        title.textContent = `${missed} Missed Check${missed > 1 ? 's' : ''}`;
        subtitle.textContent = `${checked} of ${totalSchedules} classes checked · ${missed} unchecked past schedule time`;
    } else {
        banner.classList.add('banner-ok');
        icon.textContent = 'verified';
        title.textContent = 'All On Track';
        subtitle.textContent = `${checked} checked · ${totalSchedules} total classes today`;
    }
}

function updateNotifUI(missed, noClasses) {
    const badge = document.getElementById('notifBadge');
    const list = document.getElementById('notifList');
    const bellIcon = document.querySelector('.btn-notification .material-icons');
    const markAllBtn = document.querySelector('.btn-mark-all-read');

    const corrections = window.correctionNotifications || [];

    if (noClasses && corrections.length === 0) {
        badge.style.display = 'none';
        bellIcon.style.color = 'var(--text-secondary)';
        if (markAllBtn) markAllBtn.style.display = 'none';
        list.innerHTML = '<div class="notif-empty"><span class="material-icons" style="font-size:40px;color:#ccc;display:block;margin-bottom:8px;">event_busy</span>No classes scheduled today</div>';
        return;
    }

    if (missed.length === 0 && corrections.length === 0) {
        badge.style.display = 'none';
        bellIcon.style.color = 'var(--text-secondary)';
        if (markAllBtn) markAllBtn.style.display = 'none';
        list.innerHTML = '<div class="notif-empty"><span class="material-icons" style="font-size:40px;color:#ccc;display:block;margin-bottom:8px;">notifications_none</span>All instructors checked on time!</div>';
        return;
    }

    if (markAllBtn) markAllBtn.style.display = 'inline-flex';

    
    const missedUnread = missed.filter(m => !readNotifKeys.has(m.instructorName + '|' + m.subject + '|' + m.startTime));
    const unreadCount = missedUnread.length + corrections.length; 
    
    badge.style.display = unreadCount > 0 ? 'flex' : 'none';
    badge.textContent = unreadCount;
    bellIcon.style.color = unreadCount > 0 ? '#E53935' : 'var(--text-secondary)';

    
    let html = '';

    corrections.forEach(c => {
        html += `
        <div class="notif-item correction-notif" style="border-left: 4px solid #F59E0B; background: #FFFBEB;">
            <div class="notif-icon">
                <span class="material-icons" style="color:#F59E0B;">edit_calendar</span>
            </div>
            <div class="notif-content" style="flex: 1; min-width: 0;">
                <div class="notif-title" style="font-weight:600; color:#B45309; font-size:12px;">Attendance Correction</div>
                <div class="notif-detail" style="font-size:11px; color:#451A03; margin-top:2px; font-weight: 500; white-space: normal; line-height: 1.4;">${c.message}</div>
            </div>
            <button class="notif-mark-read" title="Mark as read" onclick="markFirestoreNotifRead('${c.id}')">
                <span class="material-icons" style="font-size:18px;">done</span>
            </button>
        </div>`;
    });

    missed.forEach(m => {
        const nKey = m.instructorName + '|' + m.subject + '|' + m.startTime;
        const isRead = readNotifKeys.has(nKey);
        html += `
        <div class="notif-item${isRead ? ' notif-read' : ''}" data-notif-key="${nKey}">
            <div class="notif-icon">
                <span class="material-icons">${isRead ? 'check_circle' : 'warning'}</span>
            </div>
            <div class="notif-content">
                <div class="notif-title">${m.instructorName}</div>
                <div class="notif-detail">${m.subject} — Room ${m.room}</div>
                <div class="notif-detail">${m.dayOfWeek} ${formatTime12(m.startTime)} - ${formatTime12(m.endTime)}</div>
            </div>
            <button class="notif-mark-read" title="${isRead ? 'Marked as read' : 'Mark as read'}" onclick="markNotifRead('${nKey.replace(/'/g, "\\'")}')"
                ${isRead ? 'disabled' : ''}>
                <span class="material-icons">${isRead ? 'done_all' : 'done'}</span>
            </button>
        </div>`;
    });

    list.innerHTML = html;
}

function saveReadNotifKeys() {
    localStorage.setItem('readNotifKeys', JSON.stringify([...readNotifKeys]));
}

function markNotifRead(key) {
    readNotifKeys.add(key);
    saveReadNotifKeys();
    checkMissedSchedules(); 
}

function markAllNotifsRead() {
    document.querySelectorAll('.notif-item[data-notif-key]').forEach(el => {
        readNotifKeys.add(el.dataset.notifKey);
    });
    saveReadNotifKeys();
    checkMissedSchedules(); 
}

function toggleNotifications() {
    const dd = document.getElementById('notifDropdown');
    dd.classList.toggle('open');
}

document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('notificationWrapper');
    if (wrapper && !wrapper.contains(e.target)) {
        document.getElementById('notifDropdown').classList.remove('open');
    }

    const customSelect = document.querySelector('.custom-select-wrapper');
    if (customSelect && !customSelect.contains(e.target)) {
        const dropdown = document.getElementById('instructorSelectDropdown');
        if (dropdown) dropdown.style.display = 'none';
    }
});

document.addEventListener('DOMContentLoaded', () => {
    setupAutocompleteSelect();
});

function setupAutocompleteSelect() {
    const searchInput = document.getElementById('scheduleInstructorSearch');
    const dropdown = document.getElementById('instructorSelectDropdown');

    if (searchInput && dropdown) {
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase().trim();
            const matches = instructorsCache.filter(i => 
                i.isActive !== false && 
                (i.name.toLowerCase().includes(query) || i.department.toLowerCase().includes(query))
            );
            renderSelectDropdownItems(matches);
        });

        searchInput.addEventListener('focus', () => {
            const query = searchInput.value.toLowerCase().trim();
            const matches = instructorsCache.filter(i => 
                i.isActive !== false && 
                (i.name.toLowerCase().includes(query) || i.department.toLowerCase().includes(query))
            );
            renderSelectDropdownItems(matches);
            dropdown.style.display = 'block';
        });
    }
}

function renderSelectDropdownItems(items) {
    const dropdown = document.getElementById('instructorSelectDropdown');
    if (!dropdown) return;

    if (items.length === 0) {
        dropdown.innerHTML = '<div class="custom-select-no-results">No instructors found</div>';
        return;
    }

    dropdown.innerHTML = items.map(inst => `
        <div class="custom-select-item" onclick="selectAutocompleteInstructor('${inst.id}', '${inst.name.replace(/'/g, "\\'")}')">
            <div class="custom-select-avatar">${inst.name.charAt(0).toUpperCase()}</div>
            <div class="custom-select-details">
                <span class="custom-select-name">${inst.name}</span>
                <span class="custom-select-dept">${inst.department}</span>
            </div>
        </div>
    `).join('');
}

function selectAutocompleteInstructor(id, name) {
    const searchInput = document.getElementById('scheduleInstructorSearch');
    const hiddenInput = document.getElementById('scheduleInstructor');
    const dropdown = document.getElementById('instructorSelectDropdown');

    if (searchInput && hiddenInput && dropdown) {
        searchInput.value = name;
        hiddenInput.value = id;
        dropdown.style.display = 'none';
        handleScheduleInstructorChange(id);
    }
}

function loadDashboard() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    
    db.collection('attendance')
        .where('dateTime', '>=', startOfDay)
        .where('dateTime', '<', endOfDay)
        .orderBy('dateTime', 'desc')
        .onSnapshot(snapshot => {
            let total = 0, present = 0, notTeaching = 0, late = 0, absent = 0;
            const rows = [];
            const allTodayRecords = [];

            
            if (isInitialAttendanceLoaded) {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        const data = change.doc.data();
                        onNewCheckerAttendanceUpdate(data);
                    }
                });
            } else {
                isInitialAttendanceLoaded = true;
            }

            snapshot.forEach(doc => {
                const data = doc.data();
                data.id = doc.id;
                allTodayRecords.push(data);
                total++;
                if (data.status === 'Present') present++;
                else if (data.status === 'Present (Not Teaching)') notTeaching++;
                else if (data.status === 'Late') late++;
                else if (data.status === 'Absent') absent++;

                if (rows.length < 10) {
                    rows.push(data);
                }
            });

            window._todayAttendanceRecords = allTodayRecords;
            loadTodayCheckerActivity();

            
            document.getElementById('totalToday').textContent = total;
            document.getElementById('presentToday').textContent = present;
            document.getElementById('notTeachingToday').textContent = notTeaching;
            document.getElementById('lateToday').textContent = late;
            document.getElementById('absentToday').textContent = absent;

            
            const tbody = document.getElementById('recentRecords');
            if (rows.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="empty-state"><span class="material-icons" style="font-size:32px;color:#ccc;display:block;margin-bottom:6px;">inbox</span>No attendance records yet today</td></tr>';
            } else {
                tbody.innerHTML = rows.map(r => `
                    <tr>
                        <td><strong>${r.instructorName || ''}</strong></td>
                        <td>${r.roomName || ''}</td>
                        <td>${statusBadge(r.status)}${r.remarks ? `<br><small style="color:var(--text-secondary)">${r.remarks}</small>` : ''}</td>
                        <td>${formatTime(r.dateTime?.toDate())}</td>
                        <td>${r.checkerName || ''}</td>
                    </tr>
                `).join('');
            }
        });
}

function loadAttendanceLogs() {
    const dateVal = document.getElementById('filterDate').value;
    const statusVal = document.getElementById('filterStatus').value;
    const instructorSearch = (document.getElementById('filterInstructor').value || '').trim().toLowerCase();

    let query = db.collection('attendance').orderBy('dateTime', 'desc');

    if (dateVal) {
        const start = new Date(dateVal);
        const end = new Date(dateVal);
        end.setDate(end.getDate() + 1);
        query = query.where('dateTime', '>=', start).where('dateTime', '<', end);
    }

    if (statusVal) {
        query = query.where('status', '==', statusVal);
    }

    query = query.limit(200);

    query.get().then(snapshot => {
        const tbody = document.getElementById('attendanceTable');

        
        let records = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            data.id = doc.id;
            records.push(data);
        });

        if (instructorSearch) {
            records = records.filter(r => 
                (r.instructorName || '').toLowerCase().includes(instructorSearch)
            );
        }

        if (records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No records found</td></tr>';
            window._attendanceData = [];
            return;
        }

        let html = '';
        records.forEach(r => {
            const dt = r.dateTime?.toDate();
            html += `
                <tr>
                    <td>${formatDate(dt)}</td>
                    <td><strong>${r.instructorName || ''}</strong></td>
                    <td>${r.roomName || ''}</td>
                    <td>${r.subjectSchedule || '-'}</td>
                    <td>${statusBadge(r.status)}</td>
                    <td>${r.remarks || ''}</td>
                    <td>${formatTime(dt)}</td>
                    <td>${r.checkerName || ''}</td>
                    <td>
                        <button class="btn-icon btn-edit" onclick="editAttendanceLog('${r.id}')" title="Edit Log">
                            <span class="material-icons">edit</span>
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
        
        window._attendanceData = records;
    });
}

function exportAttendance() {
    if (!window._attendanceData || window._attendanceData.length === 0) {
        showToast('No data to export', 'warning');
        return;
    }

    const rows = [['Date', 'Instructor', 'Room', 'Subject/Schedule', 'Status', 'Remarks', 'Time', 'Checker']];
    window._attendanceData.forEach(r => {
        const dt = r.dateTime?.toDate();
        rows.push([
            formatDate(dt),
            r.instructorName || '',
            r.roomName || '',
            r.subjectSchedule || '',
            r.status || '',
            r.remarks || '',
            formatTime(dt),
            r.checkerName || ''
        ]);
    });

    downloadCSV(rows, 'attendance_logs.csv');
    showToast('CSV exported successfully!', 'success');
}

function loadInstructors() {
    db.collection('instructors').orderBy('name').onSnapshot(snapshot => {
        instructorsCache = [];
        const tbody = document.getElementById('instructorsTable');

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No instructors added yet</td></tr>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            data.id = doc.id;
            instructorsCache.push(data);

            const typeBadge = data.employmentType === 'Part-time'
                ? '<span class="badge badge-parttime">Part-time</span>'
                : '<span class="badge badge-fulltime">Full-time</span>';

            const isActive = data.isActive !== false;

            html += `
                <tr${!isActive ? ' style="opacity:0.55"' : ''}>
                    <td><strong onclick="showInstructorProfile('${doc.id}')" style="cursor:pointer;color:var(--primary);text-decoration:underline;" title="Click to view profile">${data.name}</strong></td>
                    <td>${data.department || ''}</td>
                    <td>${data.email || '-'}</td>
                    <td>${typeBadge}</td>
                    <td>${isActive
                        ? '<span class="badge badge-active">Active</span>'
                        : '<span class="badge badge-inactive">Inactive</span>'}</td>
                    <td>
                        <button class="btn-icon btn-edit" onclick="editInstructor('${doc.id}')" title="Edit">
                            <span class="material-icons">edit</span>
                        </button>
                        <button class="btn-icon ${isActive ? 'btn-danger' : 'btn-edit'}" 
                            onclick="toggleInstructorStatus('${doc.id}', ${isActive})" 
                            title="${isActive ? 'Deactivate' : 'Activate'}">
                            <span class="material-icons">${isActive ? 'person_off' : 'person'}</span>
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    });
}

function showInstructorModal(id = null) {
    document.getElementById('instructorForm').reset();
    document.getElementById('instructorId').value = '';

    let inst = null;
    if (id) {
        inst = instructorsCache.find(i => i.id === id);
    }

    
    const deptSelect = document.getElementById('instructorDept');
    deptSelect.innerHTML = '<option value="">Select department</option>';
    let deptFound = false;
    departmentsCache.filter(d => d.isActive !== false).forEach(d => {
        const selected = id && inst && inst.department === d.name ? 'selected' : '';
        if (selected) deptFound = true;
        deptSelect.innerHTML += `<option value="${d.name}" ${selected}>${d.name}</option>`;
    });
    if (id && inst && inst.department && !deptFound) {
        deptSelect.innerHTML += `<option value="${inst.department}" selected>${inst.department} (Inactive)</option>`;
    }

    if (id && inst) {
        document.getElementById('instructorModalTitle').textContent = 'Edit Instructor';
        document.getElementById('instructorId').value = id;
        document.getElementById('instructorName').value = inst.name;
        document.getElementById('instructorEmail').value = inst.email || '';
        document.getElementById('instructorType').value = inst.employmentType || 'Full-time';
    } else {
        document.getElementById('instructorModalTitle').textContent = 'Add Instructor';
        document.getElementById('instructorType').value = 'Full-time';
    }

    openModal('instructorModal');
}

function editInstructor(id) {
    showInstructorModal(id);
}

async function saveInstructor(e) {
    e.preventDefault();

    const id = document.getElementById('instructorId').value;
    const data = {
        name: document.getElementById('instructorName').value.trim(),
        department: document.getElementById('instructorDept').value.trim(),
        email: document.getElementById('instructorEmail').value.trim(),
        employmentType: document.getElementById('instructorType').value,
        isActive: true
    };

    
    const duplicate = instructorsCache.find(i =>
        i.name.toLowerCase() === data.name.toLowerCase() && i.id !== id && i.isActive !== false
    );
    if (duplicate) {
        showToast(`Instructor "${data.name}" already exists!`, 'error');
        return;
    }

    
    if (data.email) {
        const emailDup = instructorsCache.find(i =>
            i.email && i.email.toLowerCase() === data.email.toLowerCase() && i.id !== id && i.isActive !== false
        );
        if (emailDup) {
            showToast(`Email "${data.email}" is already used by ${emailDup.name}!`, 'error');
            return;
        }
    }

    try {
        if (id) {
            await db.collection('instructors').doc(id).update(data);
            showToast('Instructor updated successfully!', 'success');
        } else {
            await db.collection('instructors').add(data);
            showToast('Instructor added successfully!', 'success');
        }
        closeModal('instructorModal');
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

async function toggleInstructorStatus(id, currentlyActive) {
    const action = currentlyActive ? 'deactivate' : 'activate';
    const inst = instructorsCache.find(i => i.id === id);
    const name = inst?.name || 'this instructor';
    if (!confirm(`Are you sure you want to ${action} "${name}"?`)) return;

    try {
        await db.collection('instructors').doc(id).update({ isActive: !currentlyActive });
        showToast(`Instructor ${action}d successfully!`, 'success');
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

function loadRooms() {
    db.collection('rooms').orderBy('name').onSnapshot(snapshot => {
        roomsCache = [];
        const tbody = document.getElementById('roomsTable');

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No rooms added yet</td></tr>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            data.id = doc.id;
            roomsCache.push(data);

            const isRoomActive = data.isActive !== false;
            const escapedName = (data.name || '').replace(/'/g, "\\'");

            html += `
                <tr${!isRoomActive ? ' style="opacity:0.65"' : ''}>
                    <td><strong>${data.name}</strong></td>
                    <td>${data.building || ''}</td>
                    <td>${isRoomActive
                        ? '<span class="badge badge-active">Active</span>'
                        : '<span class="badge badge-inactive">Inactive</span>'}</td>
                    <td style="white-space: nowrap;">
                        <button class="btn-icon btn-edit" onclick="editRoom('${doc.id}')" title="Edit Room">
                            <span class="material-icons">edit</span>
                        </button>
                        <button class="btn-icon ${isRoomActive ? 'btn-danger' : 'btn-edit'}" 
                            style="${!isRoomActive ? 'color: #10B981;' : ''}"
                            onclick="toggleRoomStatus('${doc.id}', '${escapedName}', ${isRoomActive})"
                            title="${isRoomActive ? 'Deactivate Room' : 'Activate Room'}">
                            <span class="material-icons">${isRoomActive ? 'block' : 'check_circle'}</span>
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    });
}

const BUILDING_ROOM_CONFIG = {
    'PM Building': {
        code: 'PM',
        floors: {
            'Second Floor': [200, 201, 202, 203, 204, 205, 206, 207, 208],
            'Third Floor': [300, 301, 302, 303, 304, 305, 306, 307, 308]
        }
    },
    'RV Building': {
        code: 'RV',
        floors: {
            'Second Floor': [200, 201, 202, 203, 204, 205, 206, 207, 208],
            'Third Floor': [300, 301, 302, 303, 304, 305, 306, 307, 308]
        }
    },
    'JV Building': {
        code: 'JV',
        floors: {
            'Second Floor': [200, 201, 202, 203, 204, 205, 206, 207, 208],
            'Third Floor': [300, 301, 302, 303, 304, 305, 306, 307, 308]
        }
    }
};

function getSelectedBuildingValue() {
    const sel = document.getElementById('roomBuilding');
    if (!sel) return '';
    if (sel.value === '__custom__') {
        return (document.getElementById('roomBuildingCustom')?.value || '').trim();
    }
    return sel.value.trim();
}

function handleRoomBuildingChange() {
    const sel = document.getElementById('roomBuilding');
    const customInput = document.getElementById('roomBuildingCustom');
    const autoSection = document.getElementById('roomAutoSection');
    const val = sel.value;

    if (val === '__custom__') {
        customInput.style.display = 'block';
        customInput.required = true;
        autoSection.style.display = 'none';
        return;
    }

    customInput.style.display = 'none';
    customInput.required = false;

    const config = BUILDING_ROOM_CONFIG[val];
    if (config) {
        autoSection.style.display = 'block';
        const prefixEx = document.getElementById('prefixExampleText');
        if (prefixEx) prefixEx.textContent = `${config.code} 201`;
        renderAutoRoomOptions();
    } else {
        autoSection.style.display = 'none';
    }
}

function renderAutoRoomOptions() {
    const bldVal = document.getElementById('roomBuilding')?.value;
    const config = BUILDING_ROOM_CONFIG[bldVal];
    const selectEl = document.getElementById('roomAutoSelect');
    if (!config || !selectEl) return;

    const floorFilter = document.getElementById('roomFloorFilter')?.value || 'all';
    const withPrefix = document.getElementById('roomPrefixCheckbox')?.checked ?? true;
    const prefix = withPrefix ? (config.code + ' ') : '';

    const existingRoomsInBld = roomsCache
        .filter(r => r.isActive !== false && (r.building || '').toLowerCase() === bldVal.toLowerCase())
        .map(r => (r.name || '').toLowerCase());

    const currentRoomId = document.getElementById('roomId')?.value;
    const currentRoomName = currentRoomId ? (roomsCache.find(r => r.id === currentRoomId)?.name || '').toLowerCase() : '';

    let html = '<option value="">Choose Room</option>';

    const floorNames = floorFilter === 'all'
        ? ['Second Floor', 'Third Floor']
        : [floorFilter];

    floorNames.forEach(floor => {
        const rooms = config.floors[floor] || [];
        const floorLabel = floor === 'Second Floor' ? 'Second Floor (200–208)' : 'Third Floor (300–308)';

        let groupHtml = '';
        rooms.forEach(num => {
            const formattedName = `${prefix}${num}`;
            const numStr = `${num}`;
            const isAlreadyAdded = existingRoomsInBld.some(existing =>
                (existing === formattedName.toLowerCase() || existing === numStr.toLowerCase() || existing === `${config.code} ${num}`.toLowerCase()) &&
                existing !== currentRoomName
            );

            const displayLabel = isAlreadyAdded
                ? `${formattedName} (Already Added)`
                : formattedName;

            groupHtml += `<option value="${formattedName}" ${isAlreadyAdded ? 'disabled style="color:#94a3b8;"' : ''}>${displayLabel}</option>`;
        });

        if (floorFilter === 'all') {
            html += `<optgroup label="${floorLabel}">${groupHtml}</optgroup>`;
        } else {
            html += groupHtml;
        }
    });

    selectEl.innerHTML = html;
}

function handleAutoRoomSelect() {
    const selectEl = document.getElementById('roomAutoSelect');
    if (!selectEl || !selectEl.value) return;
    document.getElementById('roomName').value = selectEl.value;
}

function handlePrefixToggle() {
    const selectEl = document.getElementById('roomAutoSelect');
    const prevVal = selectEl?.value;
    renderAutoRoomOptions();

    const bldVal = document.getElementById('roomBuilding')?.value;
    const config = BUILDING_ROOM_CONFIG[bldVal];
    if (config && prevVal) {
        const withPrefix = document.getElementById('roomPrefixCheckbox')?.checked ?? true;
        const numMatch = prevVal.match(/\d+/);
        if (numMatch) {
            const newName = withPrefix ? `${config.code} ${numMatch[0]}` : numMatch[0];
            document.getElementById('roomName').value = newName;
            if (selectEl) selectEl.value = newName;
        }
    }
}

async function batchAddRemainingRooms() {
    const building = getSelectedBuildingValue();
    const config = BUILDING_ROOM_CONFIG[building];
    if (!config) {
        showToast('Please select a standard building (PM, RV, or JV)', 'warning');
        return;
    }

    const withPrefix = document.getElementById('roomPrefixCheckbox')?.checked ?? true;
    const prefix = withPrefix ? (config.code + ' ') : '';

    const allRoomNumbers = [
        ...config.floors['Second Floor'],
        ...config.floors['Third Floor']
    ];

    const existingRoomsInBld = roomsCache
        .filter(r => r.isActive !== false && (r.building || '').toLowerCase() === building.toLowerCase())
        .map(r => (r.name || '').toLowerCase());

    const toAdd = [];
    allRoomNumbers.forEach(num => {
        const formattedName = `${prefix}${num}`;
        const numStr = `${num}`;
        const alreadyExists = existingRoomsInBld.some(existing =>
            existing === formattedName.toLowerCase() ||
            existing === numStr.toLowerCase() ||
            existing === `${config.code} ${num}`.toLowerCase()
        );
        if (!alreadyExists) {
            toAdd.push(formattedName);
        }
    });

    if (toAdd.length === 0) {
        showToast(`All rooms (200–208, 300–308) for ${building} already exist!`, 'info');
        return;
    }

    if (!confirm(`Add ${toAdd.length} remaining rooms for ${building}?\n\nRooms to add:\n${toAdd.join(', ')}`)) {
        return;
    }

    try {
        const batch = db.batch();
        toAdd.forEach(name => {
            const docRef = db.collection('rooms').doc();
            batch.set(docRef, {
                name: name,
                building: building,
                isActive: true
            });
        });
        await batch.commit();
        showToast(`Successfully added ${toAdd.length} rooms to ${building}!`, 'success');
        closeModal('roomModal');
    } catch (err) {
        showToast('Error batch adding rooms: ' + err.message, 'error');
    }
}

function showRoomModal(id = null) {
    document.getElementById('roomForm').reset();
    document.getElementById('roomId').value = '';
    const customInput = document.getElementById('roomBuildingCustom');
    if (customInput) {
        customInput.style.display = 'none';
        customInput.required = false;
        customInput.value = '';
    }
    const autoSection = document.getElementById('roomAutoSection');
    if (autoSection) autoSection.style.display = 'none';
    if (document.getElementById('roomPrefixCheckbox')) {
        document.getElementById('roomPrefixCheckbox').checked = true;
    }
    if (document.getElementById('roomFloorFilter')) {
        document.getElementById('roomFloorFilter').value = 'all';
    }

    if (id) {
        const room = roomsCache.find(r => r.id === id);
        if (room) {
            document.getElementById('roomModalTitle').textContent = 'Edit Room';
            document.getElementById('roomId').value = id;
            document.getElementById('roomName').value = room.name || '';

            const bld = (room.building || '').trim();
            const bldSelect = document.getElementById('roomBuilding');

            const matchedKey = Object.keys(BUILDING_ROOM_CONFIG).find(k => k.toLowerCase() === bld.toLowerCase());
            if (matchedKey) {
                bldSelect.value = matchedKey;
                handleRoomBuildingChange();
                const autoSelect = document.getElementById('roomAutoSelect');
                if (autoSelect) {
                    const hasOption = [...autoSelect.options].some(o => o.value === room.name);
                    if (hasOption) autoSelect.value = room.name;
                }
            } else if (bld) {
                bldSelect.value = '__custom__';
                if (customInput) {
                    customInput.style.display = 'block';
                    customInput.value = bld;
                }
            } else {
                bldSelect.value = '';
            }
        }
    } else {
        document.getElementById('roomModalTitle').textContent = 'Add Room';
    }

    openModal('roomModal');
}

function editRoom(id) {
    showRoomModal(id);
}

async function saveRoom(e) {
    e.preventDefault();

    const id = document.getElementById('roomId').value;
    const building = getSelectedBuildingValue();
    const name = document.getElementById('roomName').value.trim();

    if (!building) {
        showToast('Please select or enter a building', 'error');
        return;
    }
    if (!name) {
        showToast('Please enter a room name', 'error');
        return;
    }

    const data = {
        name: name,
        building: building,
        isActive: true
    };

    // Check for duplicate room name + building
    const duplicate = roomsCache.find(r =>
        r.name.toLowerCase() === data.name.toLowerCase() &&
        r.building.toLowerCase() === data.building.toLowerCase() &&
        r.id !== id && r.isActive !== false
    );
    if (duplicate) {
        showToast(`Room "${data.name}" in ${data.building} already exists!`, 'error');
        return;
    }

    try {
        if (id) {
            await db.collection('rooms').doc(id).update(data);
            showToast('Room updated successfully!', 'success');
        } else {
            await db.collection('rooms').add(data);
            showToast('Room added successfully!', 'success');
        }
        closeModal('roomModal');
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

async function toggleRoomStatus(id, name, currentlyActive) {
    const action = currentlyActive ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} "${name}"?`)) return;

    try {
        await db.collection('rooms').doc(id).update({ isActive: !currentlyActive });
        showToast(`Room ${action}d successfully!`, 'success');
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

async function deleteRoom(id, name) {
    return toggleRoomStatus(id, name, true);
}

// ==========================================
// SUBJECTS MANAGEMENT
// ==========================================

function loadSubjects() {
    db.collection('subjects').orderBy('code').onSnapshot(snapshot => {
        subjectsCache = [];
        const tbody = document.getElementById('subjectsTable');

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No subjects added yet</td></tr>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            data.id = doc.id;
            subjectsCache.push(data);

            const isSubjectActive = data.isActive !== false;
            const escapedCode = (data.code || '').replace(/'/g, "\\'");

            html += `
                <tr${!isSubjectActive ? ' style="opacity:0.65"' : ''}>
                    <td><strong>${data.code}</strong></td>
                    <td>${data.name || ''}</td>
                    <td>${isSubjectActive
                        ? '<span class="badge badge-active">Active</span>'
                        : '<span class="badge badge-inactive">Inactive</span>'}</td>
                    <td style="white-space: nowrap;">
                        <button class="btn-icon btn-edit" onclick="editSubject('${doc.id}')" title="Edit Subject">
                            <span class="material-icons">edit</span>
                        </button>
                        <button class="btn-icon ${isSubjectActive ? 'btn-danger' : 'btn-edit'}" 
                            style="${!isSubjectActive ? 'color: #10B981;' : ''}"
                            onclick="toggleSubjectStatus('${doc.id}', '${escapedCode}', ${isSubjectActive})"
                            title="${isSubjectActive ? 'Deactivate Subject' : 'Activate Subject'}">
                            <span class="material-icons">${isSubjectActive ? 'block' : 'check_circle'}</span>
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    });
}

function showSubjectModal(id = null) {
    document.getElementById('subjectForm').reset();
    document.getElementById('subjectId').value = '';

    if (id) {
        const subject = subjectsCache.find(s => s.id === id);
        if (subject) {
            document.getElementById('subjectModalTitle').textContent = 'Edit Subject';
            document.getElementById('subjectId').value = id;
            document.getElementById('subjectCode').value = subject.code;
            document.getElementById('subjectName').value = subject.name;
        }
    } else {
        document.getElementById('subjectModalTitle').textContent = 'Add Subject';
    }

    openModal('subjectModal');
}

function editSubject(id) {
    showSubjectModal(id);
}

async function saveSubject(e) {
    e.preventDefault();

    const id = document.getElementById('subjectId').value;
    const data = {
        code: document.getElementById('subjectCode').value.trim().toUpperCase(),
        name: document.getElementById('subjectName').value.trim(),
        isActive: true
    };

    // Check for duplicate subject code
    const duplicate = subjectsCache.find(s =>
        s.code.toLowerCase() === data.code.toLowerCase() &&
        s.id !== id && s.isActive !== false
    );
    if (duplicate) {
        showToast(`Subject with code "${data.code}" already exists!`, 'error');
        return;
    }

    try {
        if (id) {
            await db.collection('subjects').doc(id).update(data);
            showToast('Subject updated successfully!', 'success');
        } else {
            await db.collection('subjects').add(data);
            showToast('Subject added successfully!', 'success');
        }
        closeModal('subjectModal');
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

async function toggleSubjectStatus(id, code, currentlyActive) {
    const action = currentlyActive ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} "${code}"?`)) return;

    try {
        await db.collection('subjects').doc(id).update({ isActive: !currentlyActive });
        showToast(`Subject ${action}d successfully!`, 'success');
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

async function deleteSubject(id, code) {
    return toggleSubjectStatus(id, code, true);
}

// ==========================================
// DEPARTMENTS MANAGEMENT
// ==========================================

function loadDepartments() {
    db.collection('departments').orderBy('code').onSnapshot(snapshot => {
        departmentsCache = [];
        const tbody = document.getElementById('departmentsTable');

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No departments added yet</td></tr>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            data.id = doc.id;
            departmentsCache.push(data);
            const isDeptActive = data.isActive !== false;
            const escapedName = (data.name || '').replace(/'/g, "\\'");

            html += `
                <tr${!isDeptActive ? ' style="opacity:0.65"' : ''}>
                    <td><strong>${data.code}</strong></td>
                    <td>${data.name || ''}</td>
                    <td>${isDeptActive
                        ? '<span class="badge badge-active">Active</span>'
                        : '<span class="badge badge-inactive">Inactive</span>'}</td>
                    <td style="white-space: nowrap;">
                        <button class="btn-icon btn-edit" onclick="editDepartment('${doc.id}')" title="Edit Department">
                            <span class="material-icons">edit</span>
                        </button>
                        <button class="btn-icon ${isDeptActive ? 'btn-danger' : 'btn-edit'}" 
                            style="${!isDeptActive ? 'color: #10B981;' : ''}"
                            onclick="toggleDepartmentStatus('${doc.id}', '${escapedName}', ${isDeptActive})"
                            title="${isDeptActive ? 'Deactivate Department' : 'Activate Department'}">
                            <span class="material-icons">${isDeptActive ? 'block' : 'check_circle'}</span>
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

        
        const instrStatDeptSelect = document.getElementById('instrStatDept');
        if (instrStatDeptSelect) {
            const currentSelected = instrStatDeptSelect.value;
            let deptHtml = '<option value="">All Departments</option>';
            departmentsCache.filter(d => d.isActive !== false).forEach(d => {
                deptHtml += `<option value="${d.name}" ${d.name === currentSelected ? 'selected' : ''}>${d.name}</option>`;
            });
            instrStatDeptSelect.innerHTML = deptHtml;
        }
    });
}

function showDepartmentModal(id = null) {
    document.getElementById('departmentForm').reset();
    document.getElementById('departmentId').value = '';

    if (id) {
        const dept = departmentsCache.find(d => d.id === id);
        if (dept) {
            document.getElementById('departmentModalTitle').textContent = 'Edit Department';
            document.getElementById('departmentId').value = id;
            document.getElementById('departmentCode').value = dept.code;
            document.getElementById('departmentName').value = dept.name;
        }
    } else {
        document.getElementById('departmentModalTitle').textContent = 'Add Department';
    }

    openModal('departmentModal');
}

function editDepartment(id) {
    showDepartmentModal(id);
}

async function saveDepartment(e) {
    e.preventDefault();

    const id = document.getElementById('departmentId').value;
    const data = {
        code: document.getElementById('departmentCode').value.trim().toUpperCase(),
        name: document.getElementById('departmentName').value.trim(),
        isActive: true
    };

    
    const duplicateCode = departmentsCache.find(d =>
        d.code.toLowerCase() === data.code.toLowerCase() &&
        d.id !== id && d.isActive !== false
    );
    if (duplicateCode) {
        showToast(`Department with code "${data.code}" already exists!`, 'error');
        return;
    }

    const duplicateName = departmentsCache.find(d =>
        d.name.toLowerCase() === data.name.toLowerCase() &&
        d.id !== id && d.isActive !== false
    );
    if (duplicateName) {
        showToast(`Department "${data.name}" already exists!`, 'error');
        return;
    }

    try {
        if (id) {
            await db.collection('departments').doc(id).update(data);
            showToast('Department updated successfully!', 'success');
        } else {
            await db.collection('departments').add(data);
            showToast('Department added successfully!', 'success');
        }
        closeModal('departmentModal');
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

async function toggleDepartmentStatus(id, name, currentlyActive) {
    const action = currentlyActive ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} "${name}"?`)) return;

    try {
        await db.collection('departments').doc(id).update({ isActive: !currentlyActive });
        showToast(`Department ${action}d successfully!`, 'success');
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

async function deleteDepartment(id, name) {
    return toggleDepartmentStatus(id, name, true);
}

let schedulesCache = [];
let expandedInstructors = new Set();
let scheduleEntryCounter = 0;

function loadSchedules() {
    db.collection('schedules').onSnapshot(snapshot => {
        schedulesCache = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            data.id = doc.id;
            schedulesCache.push(data);
        });
        renderGroupedSchedules();
    });
}

function renderGroupedSchedules() {
    const container = document.getElementById('schedulesGrouped');

    
    const grouped = {};
    schedulesCache.forEach(s => {
        if (!grouped[s.instructorId]) grouped[s.instructorId] = [];
        grouped[s.instructorId].push(s);
    });

    const instructorIds = Object.keys(grouped);
    if (instructorIds.length === 0) {
        container.innerHTML = '<div class="empty-state"><span class="material-icons" style="font-size:40px;color:#ccc;display:block;margin-bottom:8px;">event_busy</span>No schedules added yet</div>';
        return;
    }

    
    instructorIds.sort((a, b) => {
        const nameA = instructorsCache.find(i => i.id === a)?.name || '';
        const nameB = instructorsCache.find(i => i.id === b)?.name || '';
        return nameA.localeCompare(nameB);
    });

    let html = '';
    instructorIds.forEach(instId => {
        const inst = instructorsCache.find(i => i.id === instId);
        const instName = inst?.name || instId;
        const instDept = inst?.department || '';
        const schedules = grouped[instId];
        const isExpanded = expandedInstructors.has(instId);

        
        const dayOrder = ['Everyday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
        schedules.sort((a, b) => {
            const da = dayOrder.indexOf(a.dayOfWeek);
            const db2 = dayOrder.indexOf(b.dayOfWeek);
            if (da !== db2) return da - db2;
            return (a.startTime || '').localeCompare(b.startTime || '');
        });

        
        const mergedRows = [];
        const mergeKey = s => `${s.subject}||${s.course || ''}||${s.roomId}||${s.startTime}||${s.endTime}`;
        const mergeMap = {};
        schedules.forEach(s => {
            const key = mergeKey(s);
            if (!mergeMap[key]) {
                mergeMap[key] = { ...s, days: [s.dayOfWeek], ids: [s.id] };
                mergedRows.push(mergeMap[key]);
            } else {
                mergeMap[key].days.push(s.dayOfWeek);
                mergeMap[key].ids.push(s.id);
            }
        });

        
        mergedRows.sort((a, b) => {
            const da = Math.min(...a.days.map(d => dayOrder.indexOf(d)));
            const db2 = Math.min(...b.days.map(d => dayOrder.indexOf(d)));
            if (da !== db2) return da - db2;
            return (a.startTime || '').localeCompare(b.startTime || '');
        });

        
        const totalIndividual = schedules.length;

        html += `
            <div class="sched-instructor-card ${isExpanded ? 'expanded' : ''}">
                <div class="sched-instructor-header" onclick="toggleInstructorSchedules('${instId}')">
                    <div class="sched-instructor-info">
                        <div class="sched-instructor-avatar" onclick="event.stopPropagation(); showInstructorProfile('${instId}')" title="Click to view profile">${instName.charAt(0).toUpperCase()}</div>
                        <div onclick="event.stopPropagation(); showInstructorProfile('${instId}')" title="Click to view profile" style="cursor:pointer;">
                            <div class="sched-instructor-name">${instName}</div>
                            <div class="sched-instructor-dept">${instDept}</div>
                        </div>
                    </div>
                    <div class="sched-instructor-meta">
                        <span class="sched-count-badge">${mergedRows.length} subject${mergedRows.length !== 1 ? 's' : ''}</span>
                        <span class="material-icons sched-chevron">${isExpanded ? 'expand_less' : 'expand_more'}</span>
                    </div>
                </div>
                ${isExpanded ? `
                <div class="sched-instructor-body">
                    <table class="sched-table">
                        <thead>
                            <tr>
                                <th>Subject</th>
                                <th>Room</th>
                                <th>Days</th>
                                <th>Time</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${mergedRows.map(row => {
                                const roomName = roomsCache.find(r => r.id === row.roomId)?.name || row.roomId;
                                const dayBadges = row.days
                                    .sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b))
                                    .map(d => `<span class="day-badge">${d.substring(0,3)}</span>`)
                                    .join(' ');
                                
                                return `
                                <tr>
                                    <td><strong>${row.subject || ''}${(row.course || instDept) ? ` (${row.course || instDept})` : ''}</strong></td>
                                    <td>${roomName}</td>
                                    <td>${dayBadges}</td>
                                    <td>${formatTime12(row.startTime)} - ${formatTime12(row.endTime)}</td>
                                    <td>
                                        <button class="btn-icon btn-edit" onclick="editMergedSchedule('${row.ids.join(',')}')" title="Edit">
                                            <span class="material-icons">edit</span>
                                        </button>
                                        <button class="btn-icon btn-danger" onclick="deleteMergedSchedule('${row.ids.join(',')}')" title="Delete">
                                            <span class="material-icons">delete</span>
                                        </button>
                                    </td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                    <div class="sched-add-more">
                        <button class="btn-text" onclick="showScheduleModal('${instId}')">
                            <span class="material-icons">add_circle_outline</span> Add more schedules for ${instName}
                        </button>
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    });

    container.innerHTML = html;
}

function toggleInstructorSchedules(instId) {
    if (expandedInstructors.has(instId)) {
        expandedInstructors.delete(instId);
    } else {
        expandedInstructors.add(instId);
    }
    renderGroupedSchedules();
}

function showScheduleModal(preselectedInstructorId = null) {
    document.getElementById('scheduleForm').reset();
    document.getElementById('scheduleId').value = '';
    document.getElementById('scheduleModalTitle').textContent = 'Add Schedule';
    document.getElementById('scheduleSubmitBtn').innerHTML = '<span class="material-icons">save</span> Add Schedule';

    
    const searchInput = document.getElementById('scheduleInstructorSearch');
    const hiddenInput = document.getElementById('scheduleInstructor');
    const dropdown = document.getElementById('instructorSelectDropdown');

    if (searchInput) searchInput.value = '';
    if (hiddenInput) hiddenInput.value = '';
    if (dropdown) {
        dropdown.innerHTML = '';
        dropdown.style.display = 'none';
    }

    
    const schedListPanel = document.getElementById('instructorCurrentScheduleList');
    if (schedListPanel) {
        schedListPanel.innerHTML = '<div class="no-schedule-msg">Select an instructor to view their current schedule.</div>';
    }

    
    if (preselectedInstructorId) {
        const inst = instructorsCache.find(i => i.id === preselectedInstructorId);
        if (inst) {
            if (searchInput) searchInput.value = inst.name;
            if (hiddenInput) hiddenInput.value = inst.id;
            handleScheduleInstructorChange(preselectedInstructorId);
        }
    }

    
    scheduleEntryCounter = 0;
    document.getElementById('scheduleEntries').innerHTML = '';
    addScheduleEntry();

    openModal('scheduleModal');
}

function handleScheduleInstructorChange(instructorId) {
    const container = document.getElementById('instructorCurrentScheduleList');
    if (!container) return;

    if (!instructorId) {
        container.innerHTML = '<div class="no-schedule-msg">Select an instructor to view their current schedule.</div>';
        return;
    }

    
    const schedules = schedulesCache.filter(s => s.instructorId === instructorId && s.isActive !== false);

    if (schedules.length === 0) {
        container.innerHTML = '<div class="no-schedule-msg">No schedules recorded for this instructor.</div>';
        return;
    }

    const inst = instructorsCache.find(i => i.id === instructorId);
    const instDept = inst?.department || '';

    
    const dayOrder = {
        'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4,
        'Friday': 5, 'Saturday': 6, 'Sunday': 7, 'Everyday': 8
    };

    schedules.sort((a, b) => {
        const orderA = dayOrder[a.dayOfWeek] || 99;
        const orderB = dayOrder[b.dayOfWeek] || 99;
        if (orderA !== orderB) return orderA - orderB;

        return a.startTime.localeCompare(b.startTime);
    });

    
    const grouped = {};
    schedules.forEach(s => {
        if (!grouped[s.dayOfWeek]) grouped[s.dayOfWeek] = [];
        grouped[s.dayOfWeek].push(s);
    });

    let html = '';
    const sortedDays = Object.keys(grouped).sort((a, b) => (dayOrder[a] || 99) - (dayOrder[b] || 99));

    sortedDays.forEach(day => {
        html += `
            <div class="current-schedule-day-group">
                <div class="day-group-header">${day}</div>
        `;
        grouped[day].forEach(s => {
            const roomName = roomsCache.find(r => r.id === s.roomId)?.name || s.roomId;
            const courseDisplay = s.course || instDept || '';
            html += `
                <div class="current-schedule-item" onclick="closeModal('scheduleModal'); editMergedSchedule('${s.id}')" title="Click to edit this schedule" style="cursor: pointer;">
                    <div class="schedule-item-time" style="font-size: 11px; font-weight: 600; flex-shrink: 0;">
                        ${formatTime12(s.startTime)} - ${formatTime12(s.endTime)}
                    </div>
                    <div class="schedule-item-details" style="font-size: 11px; margin-top: 0; text-align: right; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                        <strong>${s.subject}${courseDisplay ? ` (${courseDisplay})` : ''}</strong> <small style="color:var(--text-secondary)">(${roomName})</small>
                    </div>
                </div>
            `;
        });
        html += '</div>';
    });

    container.innerHTML = html;
}

function addScheduleEntry(data = null) {
    scheduleEntryCounter++;
    const idx = scheduleEntryCounter;
    const container = document.getElementById('scheduleEntries');

    
    let subjectOptions = '<option value="">Select subject</option>';
    let subjectFound = false;
    subjectsCache.filter(s => s.isActive !== false).forEach(s => {
        const selected = data && data.subject === s.code ? 'selected' : '';
        if (selected) subjectFound = true;
        subjectOptions += `<option value="${s.code}" ${selected}>${s.code} - ${s.name}</option>`;
    });
    if (data && data.subject && !subjectFound) {
        subjectOptions += `<option value="${data.subject}" selected>${data.subject} (Inactive)</option>`;
    }

    
    let roomOptions = '<option value="">Select room</option>';
    roomsCache.filter(r => r.isActive !== false).forEach(r => {
        const selected = data && data.roomId === r.id ? 'selected' : '';
        roomOptions += `<option value="${r.id}" ${selected}>${r.name} (${r.building})</option>`;
    });

    
    let courseOptions = '<option value="">Select course</option>';
    let courseFound = false;
    departmentsCache.filter(d => d.isActive !== false).forEach(d => {
        const selected = data && data.course === d.code ? 'selected' : '';
        if (selected) courseFound = true;
        courseOptions += `<option value="${d.code}" ${selected}>${d.code}</option>`;
    });
    if (data && data.course && !courseFound) {
        courseOptions += `<option value="${data.course}" selected>${data.course} (Inactive)</option>`;
    }

    
    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const dayFull = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const selectedDays = data ? (Array.isArray(data.days) ? data.days : [data.dayOfWeek]) : [];

    let dayChips = days.map((d, i) => {
        const checked = selectedDays.includes(dayFull[i]) ? 'checked' : '';
        return `<label class="day-chip"><input type="checkbox" value="${dayFull[i]}" ${checked}><span>${d}</span></label>`;
    }).join('');

    const entryHtml = `
        <div class="schedule-entry" id="schedEntry${idx}">
            <div class="schedule-entry-number">${container.children.length + 1}</div>
            <div class="schedule-entry-fields">
                <div class="entry-row">
                    <div class="entry-field entry-field-subject">
                        <label>Subject</label>
                        <select class="form-input entry-subject" required>${subjectOptions}</select>
                    </div>
                    <div class="entry-field entry-field-course">
                        <label>Course / Dept *</label>
                        <select class="form-input entry-course" required>${courseOptions}</select>
                    </div>
                    <div class="entry-field entry-field-room">
                        <label>Room</label>
                        <select class="form-input entry-room" required>${roomOptions}</select>
                    </div>
                </div>
                <div class="entry-row">
                    <div class="entry-field" style="flex:1">
                        <label>Days</label>
                        <div class="day-picker entry-days">${dayChips}</div>
                    </div>
                </div>
                <div class="entry-row">
                    <div class="entry-field entry-field-time">
                        <label>Start</label>
                        <input type="time" class="form-input entry-start" value="${data?.startTime || ''}" required>
                    </div>
                    <div class="entry-field entry-field-time">
                        <label>End</label>
                        <input type="time" class="form-input entry-end" value="${data?.endTime || ''}" required>
                    </div>
                </div>
            </div>
            <button type="button" class="btn-remove-entry" onclick="removeScheduleEntry(${idx})" title="Remove">
                <span class="material-icons">close</span>
            </button>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', entryHtml);
    renumberEntries();
}

function removeScheduleEntry(idx) {
    const el = document.getElementById(`schedEntry${idx}`);
    if (el) {
        el.remove();
        renumberEntries();
    }
    
    const container = document.getElementById('scheduleEntries');
    if (container.children.length === 0) {
        addScheduleEntry();
    }
}

function renumberEntries() {
    const entries = document.querySelectorAll('#scheduleEntries .schedule-entry');
    entries.forEach((entry, i) => {
        const numEl = entry.querySelector('.schedule-entry-number');
        if (numEl) numEl.textContent = i + 1;
    });
}

function checkScheduleConflicts(newEntries, excludeIds = []) {
    const existing = schedulesCache.filter(
        s => s.isActive !== false && !excludeIds.includes(s.id)
    );

    for (const entry of newEntries) {
        const newStart = timeToMinutes(entry.startTime);
        const newEnd = timeToMinutes(entry.endTime);
        if (newStart >= newEnd) {
            return `Start time (${formatTime12(entry.startTime)}) must be before end time (${formatTime12(entry.endTime)}) for "${entry.subject}".`;
        }

        for (const ex of existing) {
            
            const sameDay = ex.dayOfWeek === entry.dayOfWeek
                || ex.dayOfWeek === 'Everyday'
                || entry.dayOfWeek === 'Everyday';
            if (!sameDay) continue;

            const exStart = timeToMinutes(ex.startTime);
            const exEnd = timeToMinutes(ex.endTime);
            const overlaps = newStart < exEnd && newEnd > exStart;
            if (!overlaps) continue;

            
            if (ex.roomId === entry.roomId) {
                const roomName = roomsCache.find(r => r.id === ex.roomId)?.name || ex.roomId;
                const instName = instructorsCache.find(i => i.id === ex.instructorId)?.name || 'another instructor';
                return `Room "${roomName}" is already booked on ${entry.dayOfWeek} ${formatTime12(ex.startTime)}-${formatTime12(ex.endTime)} by ${instName} (${ex.subject || 'Unknown'}).`;
            }

            
            if (ex.instructorId === entry.instructorId) {
                const instName = instructorsCache.find(i => i.id === entry.instructorId)?.name || 'This instructor';
                return `${instName} already has a class on ${entry.dayOfWeek} ${formatTime12(ex.startTime)}-${formatTime12(ex.endTime)} (${ex.subject || 'Unknown'}).`;
            }
        }
    }
    return null;
}

function timeToMinutes(t) {
    const [h, m] = (t || '00:00').split(':').map(Number);
    return h * 60 + m;
}

async function saveSchedule(e) {
    e.preventDefault();

    const instructorId = document.getElementById('scheduleInstructor').value;
    if (!instructorId) {
        showToast('Please select an instructor', 'error');
        return;
    }

    
    const entries = document.querySelectorAll('#scheduleEntries .schedule-entry');
    const scheduleData = [];

    for (const entry of entries) {
        const subject = entry.querySelector('.entry-subject').value.trim();
        const course = entry.querySelector('.entry-course').value.trim();
        const roomId = entry.querySelector('.entry-room').value;
        const startTime = entry.querySelector('.entry-start').value;
        const endTime = entry.querySelector('.entry-end').value;

        
        const checkedDays = [...entry.querySelectorAll('.entry-days input[type="checkbox"]:checked')]
            .map(cb => cb.value);

        if (!subject || !roomId || !startTime || !endTime) {
            showToast('Please fill in all fields for every schedule entry', 'error');
            return;
        }
        if (checkedDays.length === 0) {
            showToast('Please select at least one day for each schedule entry', 'error');
            return;
        }

        
        for (const day of checkedDays) {
            scheduleData.push({
                instructorId,
                subject,
                course,
                roomId,
                dayOfWeek: day,
                startTime,
                endTime,
                isActive: true
            });
        }
    }

    if (scheduleData.length === 0) {
        showToast('Please add at least one schedule entry', 'error');
        return;
    }

    
    const conflict = checkScheduleConflicts(scheduleData);
    if (conflict) {
        showToast('Schedule conflict: ' + conflict, 'error');
        return;
    }

    try {
        const batch = db.batch();
        scheduleData.forEach(data => {
            const ref = db.collection('schedules').doc();
            batch.set(ref, data);
        });
        await batch.commit();

        
        expandedInstructors.add(instructorId);

        showToast(`${scheduleData.length} schedule${scheduleData.length > 1 ? 's' : ''} added successfully!`, 'success');
        closeModal('scheduleModal');
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

function editMergedSchedule(idsStr) {
    const ids = idsStr.split(',');
    const firstSchedule = schedulesCache.find(s => s.id === ids[0]);
    if (!firstSchedule) return;

    
    const selectedDays = ids.map(id => {
        const s = schedulesCache.find(sc => sc.id === id);
        return s ? s.dayOfWeek : null;
    }).filter(Boolean);

    document.getElementById('editSchedIds').value = idsStr;
    document.getElementById('editSchedStart').value = firstSchedule.startTime || '';
    document.getElementById('editSchedEnd').value = firstSchedule.endTime || '';
    
    const courseSelect = document.getElementById('editSchedCourse');
    courseSelect.innerHTML = '<option value="">Select course</option>';
    let courseFound = false;
    departmentsCache.filter(d => d.isActive !== false).forEach(d => {
        const selected = firstSchedule.course === d.code ? 'selected' : '';
        if (selected) courseFound = true;
        courseSelect.innerHTML += `<option value="${d.code}" ${selected}>${d.code}</option>`;
    });
    if (firstSchedule.course && !courseFound) {
        courseSelect.innerHTML += `<option value="${firstSchedule.course}" selected>${firstSchedule.course} (Inactive)</option>`;
    }

    
    const subjectSelect = document.getElementById('editSchedSubject');
    subjectSelect.innerHTML = '<option value="">Select subject</option>';
    let subjectFound = false;
    subjectsCache.filter(s => s.isActive !== false).forEach(s => {
        const selected = firstSchedule.subject === s.code ? 'selected' : '';
        if (selected) subjectFound = true;
        subjectSelect.innerHTML += `<option value="${s.code}" ${selected}>${s.code} - ${s.name}</option>`;
    });
    if (firstSchedule.subject && !subjectFound) {
        subjectSelect.innerHTML += `<option value="${firstSchedule.subject}" selected>${firstSchedule.subject} (Inactive)</option>`;
    }

    
    const roomSelect = document.getElementById('editSchedRoom');
    roomSelect.innerHTML = '<option value="">Select room</option>';
    roomsCache.filter(r => r.isActive !== false).forEach(r => {
        roomSelect.innerHTML += `<option value="${r.id}" ${r.id === firstSchedule.roomId ? 'selected' : ''}>${r.name} (${r.building})</option>`;
    });

    
    document.querySelectorAll('#editSchedDays input[type="checkbox"]').forEach(cb => {
        cb.checked = selectedDays.includes(cb.value);
    });

    openModal('scheduleEditModal');
}

async function updateMergedSchedule(e) {
    e.preventDefault();

    const idsStr = document.getElementById('editSchedIds').value;
    const oldIds = idsStr.split(',');
    const firstSchedule = schedulesCache.find(s => s.id === oldIds[0]);
    if (!firstSchedule) return;

    const subject = document.getElementById('editSchedSubject').value.trim();
    const course = document.getElementById('editSchedCourse').value.trim();
    const roomId = document.getElementById('editSchedRoom').value;
    const startTime = document.getElementById('editSchedStart').value;
    const endTime = document.getElementById('editSchedEnd').value;
    const newDays = [...document.querySelectorAll('#editSchedDays input[type="checkbox"]:checked')]
        .map(cb => cb.value);

    if (!subject || !roomId || !startTime || !endTime) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    if (newDays.length === 0) {
        showToast('Please select at least one day', 'error');
        return;
    }

    
    const updatedEntries = newDays.map(day => ({
        instructorId: firstSchedule.instructorId,
        subject,
        course,
        roomId,
        dayOfWeek: day,
        startTime,
        endTime,
        isActive: true
    }));

    const conflict = checkScheduleConflicts(updatedEntries, oldIds);
    if (conflict) {
        showToast('Schedule conflict: ' + conflict, 'error');
        return;
    }

    try {
        const batch = db.batch();

        
        oldIds.forEach(id => {
            batch.delete(db.collection('schedules').doc(id));
        });

        
        updatedEntries.forEach(data => {
            const ref = db.collection('schedules').doc();
            batch.set(ref, data);
        });

        await batch.commit();
        showToast('Schedule updated successfully!', 'success');
        closeModal('scheduleEditModal');
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

async function deleteMergedSchedule(idsStr) {
    const ids = idsStr.split(',');
    const dayCount = ids.length;
    if (!confirm(`Delete this schedule (${dayCount} day${dayCount > 1 ? 's' : ''})?`)) return;

    try {
        const batch = db.batch();
        ids.forEach(id => batch.delete(db.collection('schedules').doc(id)));
        await batch.commit();
        showToast('Schedule deleted', 'success');
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

async function deleteSchedule(id) {
    if (!confirm('Delete this schedule?')) return;
    try {
        await db.collection('schedules').doc(id).delete();
        showToast('Schedule deleted', 'success');
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

function switchReportTab(tab) {
    document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.report-tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`[data-report-tab="${tab}"]`).classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
}

function populateReportInstructors() {
    
    const select = document.getElementById('reportInstructor');
    select.innerHTML = '<option value="">All Instructors</option>';
    instructorsCache.forEach(i => {
        select.innerHTML += `<option value="${i.id}">${i.name}</option>`;
    });

    
    const subjSelect = document.getElementById('subjStatInstructor');
    subjSelect.innerHTML = '<option value="">All Instructors</option>';
    instructorsCache.forEach(i => {
        subjSelect.innerHTML += `<option value="${i.id}">${i.name}</option>`;
    });

    
    const deptSelect = document.getElementById('instrStatDept');
    deptSelect.innerHTML = '<option value="">All Departments</option>';
    departmentsCache.filter(d => d.isActive !== false).forEach(d => {
        deptSelect.innerHTML += `<option value="${d.name}">${d.name}</option>`;
    });

    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];

    document.getElementById('reportEnd').value = todayStr;
    document.getElementById('reportStart').value = weekAgoStr;
    document.getElementById('instrStatEnd').value = todayStr;
    document.getElementById('instrStatStart').value = weekAgoStr;
    document.getElementById('subjStatEnd').value = todayStr;
    document.getElementById('subjStatStart').value = weekAgoStr;
}

async function generateReport() {
    const type = document.getElementById('reportType').value;
    const startDate = new Date(document.getElementById('reportStart').value);
    const endDateInput = new Date(document.getElementById('reportEnd').value);
    const endDate = new Date(endDateInput);
    endDate.setDate(endDate.getDate() + 1); 
    const instructorId = document.getElementById('reportInstructor').value;

    let query = db.collection('attendance')
        .where('dateTime', '>=', startDate)
        .where('dateTime', '<', endDate)
        .orderBy('dateTime', 'desc');

    try {
        const snapshot = await query.get();

        let records = [];
        let present = 0, notTeaching = 0, late = 0, absent = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            records.push(data);
        });

        
        if (instructorId) {
            records = records.filter(r => r.instructorId === instructorId);
        }

        if (records.length === 0) {
            showToast('No records found for the selected period', 'warning');
            return;
        }

        records.forEach(data => {
            if (data.status === 'Present') present++;
            else if (data.status === 'Present (Not Teaching)') notTeaching++;
            else if (data.status === 'Late') late++;
            else if (data.status === 'Absent') absent++;
        });

        
        window._reportData = records;

        
        const resultsDiv = document.getElementById('reportResults');
        resultsDiv.style.display = 'block';

        
        const typeLabel = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }[type];
        document.getElementById('reportTitle').textContent =
            `${typeLabel} Report (${formatDate(startDate)} - ${formatDate(endDateInput)})`;

        
        document.getElementById('reportSummary').innerHTML = `
            <div class="summary-card card-total">
                <span class="material-icons">assignment</span>
                <div><h3>${records.length}</h3><p>Total Records</p></div>
            </div>
            <div class="summary-card card-present">
                <span class="material-icons">check_circle</span>
                <div><h3>${present}</h3><p>Present</p></div>
            </div>
            <div class="summary-card card-notteaching">
                <span class="material-icons">person_outline</span>
                <div><h3>${notTeaching}</h3><p>Not Teaching</p></div>
            </div>
            <div class="summary-card card-late">
                <span class="material-icons">access_time</span>
                <div><h3>${late}</h3><p>Late</p></div>
            </div>
            <div class="summary-card card-absent">
                <span class="material-icons">cancel</span>
                <div><h3>${absent}</h3><p>Absent</p></div>
            </div>
        `;

        
        document.getElementById('reportTableHead').innerHTML = `
            <tr>
                <th>Date</th>
                <th>Instructor</th>
                <th>Room</th>
                <th>Status</th>
                <th>Remarks</th>
                <th>Time</th>
                <th>Checker</th>
            </tr>
        `;

        document.getElementById('reportTableBody').innerHTML = records.map(r => {
            const dt = r.dateTime?.toDate();
            return `
                <tr>
                    <td>${formatDate(dt)}</td>
                    <td><strong>${r.instructorName || ''}</strong></td>
                    <td>${r.roomName || ''}</td>
                    <td>${statusBadge(r.status)}</td>
                    <td>${r.remarks || ''}</td>
                    <td>${formatTime(dt)}</td>
                    <td>${r.checkerName || ''}</td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        showToast('Error generating report: ' + error.message, 'error');
    }
}

function exportReport() {
    if (!window._reportData || window._reportData.length === 0) {
        showToast('Generate a report first', 'warning');
        return;
    }

    const rows = [['Date', 'Instructor', 'Room', 'Subject/Schedule', 'Status', 'Remarks', 'Time', 'Checker']];
    window._reportData.forEach(r => {
        const dt = r.dateTime?.toDate();
        rows.push([
            formatDate(dt),
            r.instructorName || '',
            r.roomName || '',
            r.subjectSchedule || '',
            r.status || '',
            r.remarks || '',
            formatTime(dt),
            r.checkerName || ''
        ]);
    });

    downloadCSV(rows, 'attendance_report.csv');
    showToast('Report exported successfully!', 'success');
}

function exportReportExcel() {
    if (!window._reportData || window._reportData.length === 0) {
        showToast('Generate a report first', 'warning');
        return;
    }

    const rows = [['Date', 'Instructor', 'Room', 'Subject/Schedule', 'Status', 'Remarks', 'Time', 'Checker']];
    window._reportData.forEach(r => {
        const dt = r.dateTime?.toDate();
        rows.push([
            formatDate(dt),
            r.instructorName || '',
            r.roomName || '',
            r.subjectSchedule || '',
            r.status || '',
            r.remarks || '',
            formatTime(dt),
            r.checkerName || ''
        ]);
    });

    downloadExcel(rows, 'Attendance Report', 'attendance_report.xlsx');
    showToast('Excel exported successfully!', 'success');
}

async function generateInstructorStats() {
    const startDate = new Date(document.getElementById('instrStatStart').value);
    const endDate = new Date(document.getElementById('instrStatEnd').value);
    endDate.setDate(endDate.getDate() + 1);
    const deptFilter = document.getElementById('instrStatDept').value;

    try {
        const snapshot = await db.collection('attendance')
            .where('dateTime', '>=', startDate)
            .where('dateTime', '<', endDate)
            .orderBy('dateTime', 'desc')
            .get();

        if (snapshot.empty) {
            showToast('No records found for the selected period', 'warning');
            return;
        }

        
        const statsMap = {};
        snapshot.forEach(doc => {
            const d = doc.data();
            const id = d.instructorId || 'unknown';
            if (!statsMap[id]) {
                statsMap[id] = {
                    id: id,
                    name: d.instructorName || id,
                    department: '',
                    type: '',
                    total: 0,
                    present: 0,
                    notTeaching: 0,
                    late: 0,
                    absent: 0
                };
            }
            statsMap[id].total++;
            if (d.status === 'Present') statsMap[id].present++;
            else if (d.status === 'Present (Not Teaching)') statsMap[id].notTeaching++;
            else if (d.status === 'Late') statsMap[id].late++;
            else if (d.status === 'Absent') statsMap[id].absent++;
        });

        
        Object.values(statsMap).forEach(s => {
            const inst = instructorsCache.find(i => i.id === s.id);
            if (inst) {
                s.name = inst.name;
                s.department = inst.department || '';
                s.type = inst.employmentType || '';
            }
        });

        
        let stats = Object.values(statsMap);
        if (deptFilter) {
            stats = stats.filter(s => s.department === deptFilter);
        }
        stats.sort((a, b) => a.name.localeCompare(b.name));

        
        window._instrStatsData = stats;

        
        const totals = stats.reduce((acc, s) => {
            acc.total += s.total;
            acc.present += s.present;
            acc.notTeaching += s.notTeaching;
            acc.late += s.late;
            acc.absent += s.absent;
            return acc;
        }, { total: 0, present: 0, notTeaching: 0, late: 0, absent: 0 });

        
        document.getElementById('instrStatsResults').style.display = 'block';
        document.getElementById('instrStatsTitle').textContent =
            `Instructor Statistics (${formatDate(startDate)} — ${formatDate(endDate)})`;

        document.getElementById('instrStatsSummary').innerHTML = `
            <div class="summary-card card-total">
                <span class="material-icons">people</span>
                <div><h3>${stats.length}</h3><p>Instructors</p></div>
            </div>
            <div class="summary-card card-present">
                <span class="material-icons">check_circle</span>
                <div><h3>${totals.present}</h3><p>Present</p></div>
            </div>
            <div class="summary-card card-notteaching">
                <span class="material-icons">person_outline</span>
                <div><h3>${totals.notTeaching}</h3><p>Not Teaching</p></div>
            </div>
            <div class="summary-card card-late">
                <span class="material-icons">access_time</span>
                <div><h3>${totals.late}</h3><p>Late</p></div>
            </div>
            <div class="summary-card card-absent">
                <span class="material-icons">cancel</span>
                <div><h3>${totals.absent}</h3><p>Absent</p></div>
            </div>
        `;

        document.getElementById('instrStatsHead').innerHTML = `
            <tr>
                <th>Instructor</th>
                <th>Department</th>
                <th>Type</th>
                <th>Total</th>
                <th>Present</th>
                <th>Not Teaching</th>
                <th>Late</th>
                <th>Absent</th>
                <th>Attendance Rate</th>
            </tr>
        `;

        document.getElementById('instrStatsBody').innerHTML = stats.map(s => {
            const rate = s.total > 0 ? Math.round(((s.present + s.notTeaching) / s.total) * 100) : 0;
            const maxBar = 120;
            return `
                <tr>
                    <td><strong>${s.name}</strong></td>
                    <td>${s.department}</td>
                    <td>${s.type ? `<span class="badge badge-${s.type === 'Full-time' ? 'fulltime' : 'parttime'}">${s.type}</span>` : '-'}</td>
                    <td><strong>${s.total}</strong></td>
                    <td>${s.present}</td>
                    <td>${s.notTeaching}</td>
                    <td>${s.late}</td>
                    <td>${s.absent}</td>
                    <td>
                        <span class="stats-bar stats-bar-present" style="width:${s.total ? (s.present/s.total)*maxBar : 0}px"></span>
                        <span class="stats-bar stats-bar-notteaching" style="width:${s.total ? (s.notTeaching/s.total)*maxBar : 0}px"></span>
                        <span class="stats-bar stats-bar-late" style="width:${s.total ? (s.late/s.total)*maxBar : 0}px"></span>
                        <span class="stats-bar stats-bar-absent" style="width:${s.total ? (s.absent/s.total)*maxBar : 0}px"></span>
                        <span class="stats-pct">${rate}%</span>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        showToast('Error generating instructor statistics: ' + error.message, 'error');
    }
}

function exportInstructorStatsCSV() {
    if (!window._instrStatsData || window._instrStatsData.length === 0) {
        showToast('Generate instructor statistics first', 'warning');
        return;
    }
    const rows = [['Instructor', 'Department', 'Type', 'Total', 'Present', 'Present (Not Teaching)', 'Late', 'Absent', 'Attendance Rate']];
    window._instrStatsData.forEach(s => {
        const rate = s.total > 0 ? Math.round(((s.present + s.notTeaching) / s.total) * 100) + '%' : '0%';
        rows.push([s.name, s.department, s.type, s.total, s.present, s.notTeaching, s.late, s.absent, rate]);
    });
    downloadCSV(rows, 'instructor_statistics.csv');
    showToast('CSV exported!', 'success');
}

function exportInstructorStatsExcel() {
    if (!window._instrStatsData || window._instrStatsData.length === 0) {
        showToast('Generate instructor statistics first', 'warning');
        return;
    }
    const rows = [['Instructor', 'Department', 'Type', 'Total', 'Present', 'Present (Not Teaching)', 'Late', 'Absent', 'Attendance Rate']];
    window._instrStatsData.forEach(s => {
        const rate = s.total > 0 ? Math.round(((s.present + s.notTeaching) / s.total) * 100) + '%' : '0%';
        rows.push([s.name, s.department, s.type, s.total, s.present, s.notTeaching, s.late, s.absent, rate]);
    });
    downloadExcel(rows, 'Instructor Statistics', 'instructor_statistics.xlsx');
    showToast('Excel exported!', 'success');
}

async function generateSubjectStats() {
    const startDate = new Date(document.getElementById('subjStatStart').value);
    const endDateInput = new Date(document.getElementById('subjStatEnd').value);
    const endDate = new Date(endDateInput);
    endDate.setDate(endDate.getDate() + 1);
    const instrFilter = document.getElementById('subjStatInstructor').value;

    try {
        const query = db.collection('attendance')
            .where('dateTime', '>=', startDate)
            .where('dateTime', '<', endDate)
            .orderBy('dateTime', 'desc');

        const snapshot = await query.get();

        
        const instrSubjMap = {};
        snapshot.forEach(doc => {
            const d = doc.data();

            
            if (instrFilter && d.instructorId !== instrFilter) return;

            const instrId = d.instructorId || 'unknown';
            const instrName = d.instructorName || instrId;
            const subject = (d.subjectSchedule || '').split(' (')[0].trim() || 'N/A';

            if (!instrSubjMap[instrId]) {
                instrSubjMap[instrId] = { name: instrName, subjects: {} };
            }

            if (!instrSubjMap[instrId].subjects[subject]) {
                instrSubjMap[instrId].subjects[subject] = { total: 0, present: 0, notTeaching: 0, late: 0, absent: 0 };
            }

            const s = instrSubjMap[instrId].subjects[subject];
            s.total++;
            if (d.status === 'Present') s.present++;
            else if (d.status === 'Present (Not Teaching)') s.notTeaching++;
            else if (d.status === 'Late') s.late++;
            else if (d.status === 'Absent') s.absent++;
        });

        if (Object.keys(instrSubjMap).length === 0) {
            showToast('No records found for the selected period', 'warning');
            return;
        }

        
        Object.keys(instrSubjMap).forEach(id => {
            const inst = instructorsCache.find(i => i.id === id);
            if (inst) instrSubjMap[id].name = inst.name;
        });

        
        const flatRows = [];
        const sortedIds = Object.keys(instrSubjMap).sort((a, b) =>
            instrSubjMap[a].name.localeCompare(instrSubjMap[b].name)
        );

        sortedIds.forEach(id => {
            const instr = instrSubjMap[id];
            const subjects = Object.keys(instr.subjects).sort();
            subjects.forEach(subj => {
                const c = instr.subjects[subj];
                flatRows.push({
                    instructorName: instr.name,
                    subject: subj,
                    total: c.total,
                    present: c.present,
                    notTeaching: c.notTeaching,
                    late: c.late,
                    absent: c.absent
                });
            });
        });

        window._subjStatsData = flatRows;

        
        document.getElementById('subjStatsResults').style.display = 'block';
        document.getElementById('subjStatsTitle').textContent =
            `Subject Statistics (${formatDate(startDate)} — ${formatDate(endDateInput)})`;

        document.getElementById('subjStatsHead').innerHTML = `
            <tr>
                <th>Instructor</th>
                <th>Subject</th>
                <th>Total</th>
                <th>Present</th>
                <th>Not Teaching</th>
                <th>Late</th>
                <th>Absent</th>
                <th>Attendance Rate</th>
            </tr>
        `;

        
        let html = '';
        let prevInstructor = '';
        flatRows.forEach(r => {
            const isNewInstructor = r.instructorName !== prevInstructor;
            prevInstructor = r.instructorName;
            const rate = r.total > 0 ? Math.round(((r.present + r.notTeaching) / r.total) * 100) : 0;
            const maxBar = 100;

            if (isNewInstructor) {
                
                const instrTotal = flatRows.filter(f => f.instructorName === r.instructorName)
                    .reduce((acc, f) => {
                        acc.total += f.total; acc.present += f.present;
                        acc.notTeaching += f.notTeaching; acc.late += f.late; acc.absent += f.absent;
                        return acc;
                    }, { total: 0, present: 0, notTeaching: 0, late: 0, absent: 0 });
                const instrRate = instrTotal.total > 0 ? Math.round(((instrTotal.present + instrTotal.notTeaching) / instrTotal.total) * 100) : 0;

                html += `
                    <tr class="stats-instructor-row">
                        <td colspan="2"><strong>${r.instructorName}</strong> <small style="color:var(--text-secondary)">(${flatRows.filter(f => f.instructorName === r.instructorName).length} subjects)</small></td>
                        <td><strong>${instrTotal.total}</strong></td>
                        <td><strong>${instrTotal.present}</strong></td>
                        <td><strong>${instrTotal.notTeaching}</strong></td>
                        <td><strong>${instrTotal.late}</strong></td>
                        <td><strong>${instrTotal.absent}</strong></td>
                        <td>
                            <span class="stats-bar stats-bar-present" style="width:${instrTotal.total ? (instrTotal.present/instrTotal.total)*maxBar : 0}px"></span>
                            <span class="stats-bar stats-bar-notteaching" style="width:${instrTotal.total ? (instrTotal.notTeaching/instrTotal.total)*maxBar : 0}px"></span>
                            <span class="stats-bar stats-bar-late" style="width:${instrTotal.total ? (instrTotal.late/instrTotal.total)*maxBar : 0}px"></span>
                            <span class="stats-bar stats-bar-absent" style="width:${instrTotal.total ? (instrTotal.absent/instrTotal.total)*maxBar : 0}px"></span>
                            <span class="stats-pct"><strong>${instrRate}%</strong></span>
                        </td>
                    </tr>
                `;
            }

            html += `
                <tr>
                    <td></td>
                    <td>${r.subject}</td>
                    <td>${r.total}</td>
                    <td>${r.present}</td>
                    <td>${r.notTeaching}</td>
                    <td>${r.late}</td>
                    <td>${r.absent}</td>
                    <td>
                        <span class="stats-bar stats-bar-present" style="width:${r.total ? (r.present/r.total)*maxBar : 0}px"></span>
                        <span class="stats-bar stats-bar-notteaching" style="width:${r.total ? (r.notTeaching/r.total)*maxBar : 0}px"></span>
                        <span class="stats-bar stats-bar-late" style="width:${r.total ? (r.late/r.total)*maxBar : 0}px"></span>
                        <span class="stats-bar stats-bar-absent" style="width:${r.total ? (r.absent/r.total)*maxBar : 0}px"></span>
                        <span class="stats-pct">${rate}%</span>
                    </td>
                </tr>
            `;
        });

        document.getElementById('subjStatsBody').innerHTML = html;

    } catch (error) {
        showToast('Error generating subject statistics: ' + error.message, 'error');
    }
}

function exportSubjectStatsCSV() {
    if (!window._subjStatsData || window._subjStatsData.length === 0) {
        showToast('Generate subject statistics first', 'warning');
        return;
    }
    const rows = [['Instructor', 'Subject', 'Total', 'Present', 'Present (Not Teaching)', 'Late', 'Absent', 'Attendance Rate']];
    window._subjStatsData.forEach(r => {
        const rate = r.total > 0 ? Math.round(((r.present + r.notTeaching) / r.total) * 100) + '%' : '0%';
        rows.push([r.instructorName, r.subject, r.total, r.present, r.notTeaching, r.late, r.absent, rate]);
    });
    downloadCSV(rows, 'subject_statistics.csv');
    showToast('CSV exported!', 'success');
}

function exportSubjectStatsExcel() {
    if (!window._subjStatsData || window._subjStatsData.length === 0) {
        showToast('Generate subject statistics first', 'warning');
        return;
    }
    const rows = [['Instructor', 'Subject', 'Total', 'Present', 'Present (Not Teaching)', 'Late', 'Absent', 'Attendance Rate']];
    window._subjStatsData.forEach(r => {
        const rate = r.total > 0 ? Math.round(((r.present + r.notTeaching) / r.total) * 100) + '%' : '0%';
        rows.push([r.instructorName, r.subject, r.total, r.present, r.notTeaching, r.late, r.absent, rate]);
    });
    downloadExcel(rows, 'Subject Statistics', 'subject_statistics.xlsx');
    showToast('Excel exported!', 'success');
}

let currentCheckerRoleFilter = 'all';
let allLoadedUsers = [];

function normalizeUserName(name) {
    return (name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function setCheckerRoleFilter(filter) {
    currentCheckerRoleFilter = filter;
    document.querySelectorAll('.checker-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    renderCheckersTable();
}

function loadCheckers() {
    db.collection('users').onSnapshot(snapshot => {
        allLoadedUsers = [];
        let totalCheckers = 0;
        let activeCheckers = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            data.id = doc.id;
            allLoadedUsers.push(data);
            if (data.role === 'checker') {
                totalCheckers++;
                if (data.isActive !== false) activeCheckers++;
            }
        });

        const totalEl = document.getElementById('totalCheckersCount');
        const activeEl = document.getElementById('activeCheckersCount');
        if (totalEl) totalEl.textContent = totalCheckers;
        if (activeEl) activeEl.textContent = activeCheckers;

        renderCheckersTable();
    }, err => {
        console.error("Load checkers error:", err);
    });
}

function renderCheckersTable() {
    const tbody = document.getElementById('checkersTable');
    if (!tbody) return;

    let list = allLoadedUsers;
    if (currentCheckerRoleFilter === 'checker') {
        list = list.filter(u => u.role === 'checker');
    } else if (currentCheckerRoleFilter === 'admin') {
        list = list.filter(u => u.role === 'admin');
    }

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No accounts found</td></tr>';
        return;
    }

    
    list.sort((a, b) => {
        if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
        return (a.fullName || '').localeCompare(b.fullName || '');
    });

    tbody.innerHTML = list.map(u => {
        const created = u.createdAt?.toDate ? u.createdAt.toDate() : null;
        const escapedName = (u.fullName || '').replace(/'/g, "\\'");
        const escapedEmail = (u.email || '').replace(/'/g, "\\'");
        const roleStr = u.role || 'checker';
        const roleBadge = roleStr === 'admin'
            ? '<span class="badge" style="background:#EDE9FE; color:#6D28D9; font-weight:600;">Admin</span>'
            : '<span class="badge" style="background:#E0F2FE; color:#0369A1; font-weight:600;">Checker</span>';

        return `
            <tr>
                <td><strong>${u.fullName || '-'}</strong></td>
                <td>${u.email || '-'}</td>
                <td>${roleBadge}</td>
                <td>${u.isActive !== false
                    ? '<span class="badge badge-active">Active</span>'
                    : '<span class="badge badge-inactive">Inactive</span>'}</td>
                <td>${created ? formatDate(created) : '-'}</td>
                <td>
                    <button class="btn-icon btn-edit" title="Edit Account"
                        onclick="showEditCheckerModal('${u.id}', '${escapedName}', '${escapedEmail}', '${roleStr}')">
                        <span class="material-icons">edit</span>
                    </button>
                    <button class="btn-icon ${u.isActive !== false ? 'btn-danger' : 'btn-edit'}" 
                        title="${u.isActive !== false ? 'Deactivate' : 'Activate'}"
                        style="${u.isActive === false ? 'color: #10B981;' : ''}"
                        onclick="toggleCheckerStatus('${u.id}', ${u.isActive !== false})">
                        <span class="material-icons">${u.isActive !== false ? 'block' : 'check_circle'}</span>
                    </button>
                    <button class="btn-icon btn-danger" title="Delete Account"
                        onclick="deleteCheckerAccount('${u.id}', '${escapedEmail}')">
                        <span class="material-icons">delete</span>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function showCheckerModal() {
    document.getElementById('checkerForm').reset();
    openModal('checkerModal');
}

async function createChecker(e) {
    e.preventDefault();

    const firstName = document.getElementById('checkerFirstName').value.trim();
    const middleName = document.getElementById('checkerMiddleName').value.trim();
    const lastName = document.getElementById('checkerLastName').value.trim();
    const name = [firstName, middleName, lastName].filter(Boolean).join(' ');
    const email = document.getElementById('checkerEmail').value.trim().toLowerCase();
    const password = document.getElementById('checkerPassword').value;
    const role = document.getElementById('checkerRole').value;

    if (!firstName || !lastName) {
        showToast('First name and last name are required.', 'warning');
        return;
    }

    const duplicateEmail = allLoadedUsers.some(user => (user.email || '').trim().toLowerCase() === email);
    const duplicateName = allLoadedUsers.some(user => normalizeUserName(user.fullName) === normalizeUserName(name));

    if (duplicateEmail && duplicateName) {
        showToast('Both the name and email are already in use.', 'warning');
        return;
    }

    if (duplicateEmail) {
        showToast('This email is already in use. Please use a different email.', 'warning');
        return;
    }

    if (duplicateName) {
        showToast('This name is already in use. Please enter a different name.', 'warning');
        return;
    }

    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'warning');
        return;
    }

    // Verify admin is still signed in before proceeding
    if (!auth.currentUser) {
        showToast('Error: You are not signed in. Please refresh and log in again.', 'error');
        return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating...';

    try {
        // Step 1: Create Firebase Auth account via REST API
        const apiKey = firebaseConfig.apiKey;

        const response = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email,
                    password: password,
                    returnSecureToken: false
                })
            }
        );

        const data = await response.json();
        let checkerUid = data.localId;

        // If email already exists in Auth, look up the UID so we can still save Firestore doc
        if (data.error && data.error.message === 'EMAIL_EXISTS') {
            throw new Error('EMAIL_EXISTS');
            // Auth account exists but no Firestore doc — we'll create it below
        } else if (!response.ok || data.error) {
            const errMsg = data.error?.message || `HTTP ${response.status}`;
            throw new Error(errMsg);
        }

        if (!checkerUid) {
            throw new Error('No user ID returned from Firebase.');
        }

        
        await db.collection('users').doc(checkerUid).set({
            email: email,
            emailLower: email,
            firstName: firstName,
            middleName: middleName,
            lastName: lastName,
            fullName: name,
            fullNameLower: normalizeUserName(name),
            role: role,
            isActive: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        
        const verifyDoc = await db.collection('users').doc(checkerUid).get();
        if (!verifyDoc.exists) {
            throw new Error('Firestore write failed — document not found after save. Check your Firestore Security Rules.');
        }

        const roleLabel = role === 'admin' ? 'Admin' : 'Checker';
        showToast(`${roleLabel} account created for ${name}!`, 'success');
        closeModal('checkerModal');

    } catch (error) {
        console.error('Create checker error:', error);
        let msg = error.message || String(error);
        if (msg.includes('EMAIL_EXISTS')) msg = 'This email is already in use.';
        if (msg.includes('WEAK_PASSWORD')) msg = 'Password is too weak (min 6 characters).';
        if (msg.includes('INVALID_EMAIL')) msg = 'Invalid email address.';
        if (msg.includes('OPERATION_NOT_ALLOWED')) msg = 'Email/password sign-in is not enabled. Enable it in Firebase Console → Authentication → Sign-in method.';
        showToast('Error: ' + msg, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Account';
    }
}

async function toggleCheckerStatus(uid, currentlyActive) {
    const action = currentlyActive ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} this checker?`)) return;

    try {
        await db.collection('users').doc(uid).update({ isActive: !currentlyActive });
        showToast(`Checker ${action}d successfully!`, 'success');
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

async function deleteCheckerAccount(uid, email) {
    if (auth.currentUser && auth.currentUser.email === email) {
        showToast('You cannot delete your own active admin account.', 'warning');
        return;
    }
    if (!confirm(`Are you sure you want to permanently delete the account for "${email}"?\n\nThis will remove the user from the staff list.`)) {
        return;
    }

    try {
        await db.collection('users').doc(uid).delete();
        showToast(`Account for ${email} deleted successfully.`, 'success');
    } catch (error) {
        console.error('Delete account error:', error);
        showToast('Error deleting account: ' + error.message, 'error');
    }
}

function showEditCheckerModal(uid, fullName, email, role) {
    const form = document.getElementById('editCheckerForm');
    const uidInput = document.getElementById('editCheckerUid');
    const firstNameInput = document.getElementById('editCheckerFirstName');
    const middleNameInput = document.getElementById('editCheckerMiddleName');
    const lastNameInput = document.getElementById('editCheckerLastName');
    const emailInput = document.getElementById('editCheckerEmail');

    if (!form || !uidInput || !firstNameInput || !middleNameInput || !lastNameInput || !emailInput) {
        console.error('Edit account modal fields are missing. Reload the page to fetch the latest form.');
        showToast('The account form was updated. Please refresh the page and try again.', 'warning');
        return;
    }

    form.reset();
    uidInput.value = uid;
    const user = allLoadedUsers.find(item => item.id === uid) || {};
    const fallbackParts = (fullName || '').trim().split(/\s+/).filter(Boolean);
    firstNameInput.value = user.firstName || fallbackParts[0] || '';
    middleNameInput.value = user.middleName || (fallbackParts.length > 2 ? fallbackParts.slice(1, -1).join(' ') : '');
    lastNameInput.value = user.lastName || (fallbackParts.length > 1 ? fallbackParts[fallbackParts.length - 1] : '');
    emailInput.value = email || '';
    const roleSelect = document.getElementById('editCheckerRole');
    if (roleSelect) {
        roleSelect.value = role || 'checker';
    }
    openModal('editCheckerModal');
}

async function updateChecker(e) {
    e.preventDefault();

    const uid = document.getElementById('editCheckerUid').value;
    const firstName = document.getElementById('editCheckerFirstName').value.trim();
    const middleName = document.getElementById('editCheckerMiddleName').value.trim();
    const lastName = document.getElementById('editCheckerLastName').value.trim();
    const newName = [firstName, middleName, lastName].filter(Boolean).join(' ');
    const newEmail = document.getElementById('editCheckerEmail').value.trim().toLowerCase();
    const newRole = document.getElementById('editCheckerRole') ? document.getElementById('editCheckerRole').value : 'checker';

    if (!firstName || !lastName || !newEmail) {
        showToast('First name, last name, and email are required.', 'warning');
        return;
    }

    const duplicateEmail = allLoadedUsers.some(user =>
        user.id !== uid && (user.email || '').trim().toLowerCase() === newEmail
    );
    const duplicateName = allLoadedUsers.some(user =>
        user.id !== uid && normalizeUserName(user.fullName) === normalizeUserName(newName)
    );

    if (duplicateEmail && duplicateName) {
        showToast('Both the name and email are already in use.', 'warning');
        return;
    }

    if (duplicateEmail) {
        showToast('This email is already in use. Please use a different email.', 'warning');
        return;
    }

    if (duplicateName) {
        showToast('This name is already in use. Please enter a different name.', 'warning');
        return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
    }

    try {
        
        const updates = { 
            firstName: firstName,
            middleName: middleName,
            lastName: lastName,
            fullName: newName,
            fullNameLower: normalizeUserName(newName),
            email: newEmail,
            emailLower: newEmail,
            role: newRole
        };
        await db.collection('users').doc(uid).update(updates);

        const roleLabel = newRole === 'admin' ? 'Admin' : 'Checker';
        showToast(`User "${newName}" updated successfully! Assigned role: ${roleLabel}.`, 'success');
        closeModal('editCheckerModal');

    } catch (error) {
        console.error('Update user error:', error);
        showToast('Error updating account: ' + error.message, 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save Changes';
        }
    }
}

async function handleLogout() {
    if (!confirm('Are you sure you want to sign out?')) return;
    await auth.signOut();
    window.location.href = 'index.html';
}

function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function formatDate(date) {
    if (!date) return '';
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatTime(date) {
    if (!date) return '';
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

function statusBadge(status) {
    const cls = {
        'Present': 'badge-present',
        'Present (Not Teaching)': 'badge-notteaching',
        'Late': 'badge-late',
        'Absent': 'badge-absent'
    }[status] || '';

    const icon = {
        'Present': 'check_circle',
        'Present (Not Teaching)': 'person_outline',
        'Late': 'access_time',
        'Absent': 'cancel'
    }[status] || 'help';

    return `<span class="badge ${cls}">
        <span class="material-icons" style="font-size:14px">${icon}</span> ${status}
    </span>`;
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast ' + type;
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

function downloadCSV(rows, filename) {
    const csv = rows.map(row =>
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

function downloadExcel(rows, sheetName, filename) {
    if (typeof XLSX === 'undefined') {
        showToast('Excel library not loaded. Try refreshing the page.', 'error');
        return;
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);

    
    const colWidths = rows[0].map((_, colIdx) => {
        let maxLen = 10;
        rows.forEach(row => {
            const len = String(row[colIdx] || '').length;
            if (len > maxLen) maxLen = len;
        });
        return { wch: Math.min(maxLen + 2, 40) };
    });
    ws['!cols'] = colWidths;

    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, filename);
}

let calendarYear, calendarMonth; 
let noClassDaysCache = []; 
let noClassUnsubscribe = null;

function loadCalendar() {
    const now = new Date();
    calendarYear = now.getFullYear();
    calendarMonth = now.getMonth();
    listenNoClassDays();
}

function listenNoClassDays() {
    if (noClassUnsubscribe) noClassUnsubscribe();
    noClassUnsubscribe = db.collection('noClassDates')
        .orderBy('date', 'asc')
        .onSnapshot(snap => {
            noClassDaysCache = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderCalendar();
            renderNoClassTable();
        }, err => {
            console.error('Error listening to noClassDates:', err);
        });
}

function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const label = document.getElementById('calendarMonthLabel');
    if (!grid || !label) return;

    const monthNames = ['January','February','March','April','May','June',
        'July','August','September','October','November','December'];
    label.textContent = `${monthNames[calendarMonth]} ${calendarYear}`;

    
    let html = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
        .map(d => `<div class="cal-header">${d}</div>`).join('');

    const firstDay = new Date(calendarYear, calendarMonth, 1).getDay(); 
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const today = new Date();

    
    const prevMonthDays = new Date(calendarYear, calendarMonth, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
        html += `<div class="cal-day other-month">${prevMonthDays - i}</div>`;
    }

    
    for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(calendarYear, calendarMonth, d);
        const dateStr = formatDateStr(dateObj);
        const isToday = dateObj.toDateString() === today.toDateString();
        const noClassInfo = getNoClassForDate(dateStr);

        let classes = 'cal-day';
        if (isToday) classes += ' today';
        if (noClassInfo) classes += ' no-class';

        let tooltip = noClassInfo ? `<span class="cal-tooltip">${noClassInfo.reason}</span>` : '';
        html += `<div class="${classes}" onclick="onCalendarDayClick('${dateStr}')">${d}${tooltip}</div>`;
    }

    
    const totalCells = firstDay + daysInMonth;
    const remainder = totalCells % 7;
    if (remainder > 0) {
        for (let i = 1; i <= 7 - remainder; i++) {
            html += `<div class="cal-day other-month">${i}</div>`;
        }
    }

    grid.innerHTML = html;
}

function formatDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function getNoClassForDate(dateStr) {
    
    for (const nc of noClassDaysCache) {
        const start = nc.date.toDate ? formatDateStr(nc.date.toDate()) : '';
        const end = nc.endDate ? (nc.endDate.toDate ? formatDateStr(nc.endDate.toDate()) : '') : start;
        if (dateStr >= start && dateStr <= end) return nc;
    }
    return null;
}

function changeCalendarMonth(delta) {
    calendarMonth += delta;
    if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
    if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
    renderCalendar();
}

function onCalendarDayClick(dateStr) {
    const existing = getNoClassForDate(dateStr);
    if (existing) {
        
        if (confirm(`No Class: ${existing.reason}\n\nRemove this entry?`)) {
            deleteNoClassDay(existing.id);
        }
    } else {
        showNoClassModal(dateStr);
    }
}

function showNoClassModal(dateStr) {
    document.getElementById('noClassId').value = '';
    document.getElementById('noClassForm').reset();
    document.getElementById('customReasonGroup').style.display = 'none';
    document.getElementById('noClassModalTitle').textContent = 'Add No Class Day';
    if (dateStr) {
        document.getElementById('noClassDate').value = dateStr;
    }
    openModal('noClassModal');
}

function toggleCustomReason() {
    const sel = document.getElementById('noClassReasonSelect').value;
    document.getElementById('customReasonGroup').style.display = sel === 'custom' ? 'block' : 'none';
    if (sel === 'custom') {
        document.getElementById('noClassCustomReason').focus();
    }
}

async function saveNoClassDay(event) {
    event.preventDefault();
    const id = document.getElementById('noClassId').value;
    const dateVal = document.getElementById('noClassDate').value;
    const endDateVal = document.getElementById('noClassEndDate').value;
    const reasonSel = document.getElementById('noClassReasonSelect').value;
    const customReason = document.getElementById('noClassCustomReason').value.trim();

    if (!dateVal) { showToast('Please select a date', 'error'); return; }
    if (!reasonSel) { showToast('Please select a reason', 'error'); return; }

    const reason = reasonSel === 'custom' ? customReason : reasonSel;
    if (!reason) { showToast('Please enter a custom reason', 'error'); return; }

    
    const startParts = dateVal.split('-');
    const startDate = new Date(+startParts[0], +startParts[1] - 1, +startParts[2]);

    const data = {
        date: startDate,
        reason: reason,
        addedBy: auth.currentUser ? auth.currentUser.email : 'admin',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (endDateVal) {
        const endParts = endDateVal.split('-');
        data.endDate = new Date(+endParts[0], +endParts[1] - 1, +endParts[2]);
    }

    try {
        if (id) {
            await db.collection('noClassDates').doc(id).update(data);
            showToast('No class day updated');
        } else {
            await db.collection('noClassDates').add(data);
            showToast('No class day added');
        }
        closeModal('noClassModal');
    } catch (err) {
        console.error('Error saving no class day:', err);
        showToast('Error saving: ' + err.message, 'error');
    }
}

async function deleteNoClassDay(id) {
    try {
        await db.collection('noClassDates').doc(id).delete();
        showToast('No class day removed');
    } catch (err) {
        console.error('Error deleting no class day:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

function editNoClassDay(id) {
    const entry = noClassDaysCache.find(nc => nc.id === id);
    if (!entry) return;
    document.getElementById('noClassId').value = id;
    document.getElementById('noClassDate').value = entry.date.toDate
        ? formatDateStr(entry.date.toDate()) : '';
    document.getElementById('noClassEndDate').value = entry.endDate && entry.endDate.toDate
        ? formatDateStr(entry.endDate.toDate()) : '';

    
    const sel = document.getElementById('noClassReasonSelect');
    const presetValues = [...sel.options].map(o => o.value);
    if (presetValues.includes(entry.reason)) {
        sel.value = entry.reason;
        document.getElementById('customReasonGroup').style.display = 'none';
    } else {
        sel.value = 'custom';
        document.getElementById('noClassCustomReason').value = entry.reason;
        document.getElementById('customReasonGroup').style.display = 'block';
    }

    document.getElementById('noClassModalTitle').textContent = 'Edit No Class Day';
    openModal('noClassModal');
}

function renderNoClassTable() {
    const tbody = document.getElementById('noClassTable');
    if (!tbody) return;

    if (noClassDaysCache.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No entries yet</td></tr>';
        return;
    }

    
    const sorted = [...noClassDaysCache].sort((a, b) => {
        const da = a.date.toDate ? a.date.toDate() : new Date(0);
        const db2 = b.date.toDate ? b.date.toDate() : new Date(0);
        return db2 - da; 
    });

    tbody.innerHTML = sorted.map(nc => {
        const dateStr = nc.date.toDate ? nc.date.toDate().toLocaleDateString() : '';
        const endStr = nc.endDate && nc.endDate.toDate ? ' — ' + nc.endDate.toDate().toLocaleDateString() : '';
        return `<tr>
            <td>${dateStr}${endStr}</td>
            <td>${nc.reason}</td>
            <td>${nc.addedBy || ''}</td>
            <td>
                <button class="btn-icon" title="Edit" onclick="editNoClassDay('${nc.id}')">
                    <span class="material-icons" style="font-size:18px">edit</span>
                </button>
                <button class="btn-icon" title="Delete" onclick="if(confirm('Remove this entry?')) deleteNoClassDay('${nc.id}')">
                    <span class="material-icons" style="font-size:18px;color:var(--absent)">delete</span>
                </button>
            </td>
        </tr>`;
    }).join('');
}

let activeEditLogId = null;

function editAttendanceLog(id) {
    db.collection('attendance').doc(id).get().then(doc => {
        if (!doc.exists) {
            showToast('Log record not found', 'error');
            return;
        }
        const data = doc.data();
        activeEditLogId = id;
        document.getElementById('editLogId').value = id;
        document.getElementById('editLogInstructor').value = data.instructorName || '';
        document.getElementById('editLogSchedule').value = data.subjectSchedule || '';
        document.getElementById('editLogStatus').value = data.status || 'Present';
        document.getElementById('editLogRemarks').value = data.remarks || '';
        
        openModal('attendanceLogModal');
    }).catch(err => {
        showToast('Error loading record: ' + err.message, 'error');
    });
}

async function saveAttendanceLog(e) {
    e.preventDefault();
    if (!activeEditLogId) return;
    
    const status = document.getElementById('editLogStatus').value;
    const remarks = document.getElementById('editLogRemarks').value.trim();
    
    try {
        await db.collection('attendance').doc(activeEditLogId).update({
            status: status,
            remarks: remarks
        });
        showToast('Attendance log updated successfully', 'success');
        closeModal('attendanceLogModal');
        loadAttendanceLogs(); 
    } catch(err) {
        showToast('Error updating log: ' + err.message, 'error');
    }
}

function deleteAttendanceLog(id) {
    if (!confirm('Are you sure you want to delete this attendance log?')) return;
    
    db.collection('attendance').doc(id).delete().then(() => {
        showToast('Attendance log deleted', 'success');
        loadAttendanceLogs(); 
    }).catch(err => {
        showToast('Error deleting log: ' + err.message, 'error');
    });
}

let isInitialAttendanceLoaded = false;
let newCheckerChecksCount = parseInt(sessionStorage.getItem('newCheckerChecksCount') || '0', 10);
let newAttendanceLogsCount = parseInt(sessionStorage.getItem('newAttendanceLogsCount') || '0', 10);
let unreadCorrectionsCount = 0;

function refreshCheckerBadge() {
    const totalCount = (unreadCorrectionsCount || 0) + (newCheckerChecksCount || 0);
    const badge = document.getElementById('checkerBadge');
    if (badge) {
        if (totalCount > 0) {
            badge.textContent = totalCount > 99 ? '99+' : totalCount;
            badge.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
        }
    }

    const pageBadge = document.getElementById('checkerUpdatesCountBadge');
    const pendingCount = document.getElementById('pendingUpdatesCount');
    const markAllBtn = document.getElementById('btnMarkAllCheckerUpdatesRead');

    if (pageBadge) {
        if (unreadCorrectionsCount > 0) {
            pageBadge.textContent = `${unreadCorrectionsCount} New`;
            pageBadge.style.display = 'inline-block';
        } else {
            pageBadge.style.display = 'none';
        }
    }

    if (pendingCount) {
        pendingCount.textContent = unreadCorrectionsCount;
    }

    if (markAllBtn) {
        markAllBtn.style.display = unreadCorrectionsCount > 0 ? 'inline-flex' : 'none';
    }
}

function refreshAttendanceBadge() {
    const badge = document.getElementById('attendanceBadge');
    if (badge) {
        if (newAttendanceLogsCount > 0) {
            badge.textContent = newAttendanceLogsCount > 99 ? '99+' : newAttendanceLogsCount;
            badge.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
        }
    }
}

function clearCheckerBadge() {
    newCheckerChecksCount = 0;
    sessionStorage.setItem('newCheckerChecksCount', '0');
    refreshCheckerBadge();
}

function clearAttendanceBadge() {
    newAttendanceLogsCount = 0;
    sessionStorage.setItem('newAttendanceLogsCount', '0');
    refreshAttendanceBadge();
}

function onNewCheckerAttendanceUpdate(data) {
    if (currentPage !== 'checkers') {
        newCheckerChecksCount++;
        sessionStorage.setItem('newCheckerChecksCount', newCheckerChecksCount);
        refreshCheckerBadge();
    }
    if (currentPage !== 'attendance') {
        newAttendanceLogsCount++;
        sessionStorage.setItem('newAttendanceLogsCount', newAttendanceLogsCount);
        refreshAttendanceBadge();
    }

    
    const checker = data.checkerName || 'Checker';
    const room = data.roomName || 'room';
    const instructor = data.instructorName || 'instructor';
    const status = data.status || 'checked';
    showToast(`Update from ${checker}: ${instructor} in ${room} (${status})`, 'info');
}

function updateCheckerBadge(count) {
    unreadCorrectionsCount = count;
    refreshCheckerBadge();
}

function renderCheckerUpdates(corrections) {
    const container = document.getElementById('checkerUpdatesList');
    if (!container) return;

    if (!corrections || corrections.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 24px 0;">
                <span class="material-icons" style="font-size: 40px; color: #10B981; display: block; margin-bottom: 8px;">check_circle</span>
                <span style="font-weight: 500; color: var(--text-secondary);">No pending updates from checkers. All clear!</span>
            </div>
        `;
        return;
    }

    let html = '<div class="checker-updates-items">';
    corrections.forEach(c => {
        const timeStr = c.timestamp ? formatTime(c.timestamp.toDate()) + ' (' + formatDate(c.timestamp.toDate()) + ')' : 'Recent';
        html += `
            <div class="checker-update-card">
                <div style="display: flex; gap: 14px; align-items: flex-start; flex: 1; min-width: 0;">
                    <div class="checker-update-avatar">
                        <span class="material-icons">edit_note</span>
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div class="checker-update-title">
                            <strong>${c.title || 'Attendance Correction'}</strong>
                            <span class="badge badge-warning">New</span>
                            <small style="color: #B45309; opacity: 0.8; font-size: 11px;">${timeStr}</small>
                        </div>
                        <p class="checker-update-desc">${c.message || 'No description provided.'}</p>
                    </div>
                </div>
                <button class="btn-secondary" style="padding: 6px 12px; font-size: 12px; border-color: #D97706; color: #B45309; white-space: nowrap; flex-shrink: 0;" onclick="markCheckerUpdateRead('${c.id}')" title="Mark as reviewed">
                    <span class="material-icons" style="font-size: 16px;">done</span> Mark Read
                </button>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

function markCheckerUpdateRead(id) {
    db.collection('notifications').doc(id).update({
        read: true
    }).then(() => {
        showToast('Checker update marked as read', 'success');
    }).catch(err => {
        showToast('Error: ' + err.message, 'error');
    });
}

async function markAllCheckerUpdatesRead() {
    const corrections = window.correctionNotifications || [];
    if (corrections.length === 0) return;

    try {
        const batch = db.batch();
        corrections.forEach(c => {
            const ref = db.collection('notifications').doc(c.id);
            batch.update(ref, { read: true });
        });
        await batch.commit();
        showToast('All checker updates marked as read', 'success');
    } catch (err) {
        showToast('Error marking updates as read: ' + err.message, 'error');
    }
}

function loadTodayCheckerActivity() {
    const tbody = document.getElementById('checkerRecentActivityTable');
    if (!tbody) return;

    const records = window._todayAttendanceRecords || [];
    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No checks recorded today yet</td></tr>';
        return;
    }

    tbody.innerHTML = records.slice(0, 15).map(r => `
        <tr>
            <td>${formatTime(r.dateTime?.toDate())}</td>
            <td><strong>${r.checkerName || 'Checker'}</strong></td>
            <td>${r.instructorName || ''}</td>
            <td>${r.roomName || ''}</td>
            <td>${r.subjectSchedule || '-'}</td>
            <td>${statusBadge(r.status)}${r.remarks ? `<br><small style="color:var(--text-secondary)">${r.remarks}</small>` : ''}</td>
        </tr>
    `).join('');
}

function listenToFirestoreNotifications() {
    if (window._isListeningToNotifications) return;
    window._isListeningToNotifications = true;

    db.collection('notifications').onSnapshot(snapshot => {
        let newCorrections = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            data.id = doc.id;
            if (data.read === false) {
                newCorrections.push(data);
            }
        });
        
        
        newCorrections.sort((a, b) => {
            const ta = a.timestamp ? a.timestamp.toDate() : new Date(0);
            const tb = b.timestamp ? b.timestamp.toDate() : new Date(0);
            return tb - ta;
        });

        
        snapshot.docChanges().forEach(change => {
            if (change.type === "added") {
                const data = change.doc.data();
                const t = data.timestamp ? data.timestamp.toDate() : new Date();
                if (new Date() - t < 10000) { 
                    showToast(`Checker Update: ${data.message}`, "warning");
                }
            }
        });

        window.correctionNotifications = newCorrections;
        updateCheckerBadge(newCorrections.length);
        renderCheckerUpdates(newCorrections);
        checkMissedSchedules(); 
    }, err => {
        console.error("Notifications listener error:", err);
    });
}

function markFirestoreNotifRead(id) {
    db.collection('notifications').doc(id).update({
        read: true
    }).then(() => {
        showToast('Notification marked as read', 'success');
    }).catch(err => {
        console.error("Error marking notification read:", err);
    });
}

