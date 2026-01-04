const { createClient } = supabase;

const supabaseClient = createClient(
  'https://xoxbmcfsawwibxdegznv.supabase.co',
  'sb_publishable_PWIgfu7AZifTuNM-3CNlHA_D7wqFB7s'
);

let user = null;
let hideCompleted = false;

// Theme – saved per user
function loadTheme() {
    if (!user) return;
    const saved = localStorage.getItem(`theme_${user.id}`) || 'light';
    document.body.className = '';
    document.body.classList.add(saved);
}

function saveTheme(theme) {
    if (!user) return;
    localStorage.setItem(`theme_${user.id}`, theme);
}

// Settings dropdown
document.getElementById('settingsBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('settingsDropdown').classList.toggle('active');
});

document.addEventListener('click', () => {
    document.getElementById('settingsDropdown').classList.remove('active');
});

document.querySelectorAll('.settings-item').forEach(item => {
    item.addEventListener('click', () => {
        const theme = item.dataset.theme;
        document.body.className = '';
        document.body.classList.add(theme);
        saveTheme(theme);
    });
});

// Auth – mandatory
document.getElementById('auth-btn').addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const message = document.getElementById('auth-message');

    if (!email || !password) {
        message.textContent = 'Fill in email and password';
        return;
    }

    message.textContent = 'Loading...';

    let { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error && error.message === 'Invalid login credentials') {
        ({ data, error } = await supabaseClient.auth.signUp({ email, password }));
        if (!error) {
            message.textContent = 'Check your email for confirmation link!';
            return;
        }
    }

    if (error) {
        message.textContent = error.message;
    } else {
        user = data.user;
        document.getElementById('login-page').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        loadTheme();
        initApp();
    }
});

supabaseClient.auth.getSession().then(({ data }) => {
    if (data.session) {
        user = data.session.user;
        document.getElementById('login-page').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        loadTheme();
        initApp();
    }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    location.reload();
});

// App
async function initApp() {
    const today = new Date().toISOString().split('T')[0];
    const todayFull = new Date().toLocaleDateString('en-US', { timeZone: 'Pacific/Auckland', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('dateLabel').textContent = `Today: ${todayFull}`;

    let bookingsDate = today;
    let historyDate = today;

    document.getElementById('bookingsDate').value = today;
    document.getElementById('historyDate').value = today;

    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');

            if (tab.dataset.tab === 'bookings') {
                bookingsDate = today;
                document.getElementById('bookingsDate').value = today;
                loadBookings();
            } else if (tab.dataset.tab === 'history') {
                historyDate = today;
                document.getElementById('historyDate').value = today;
                loadHistory();
            } else if (tab.dataset.tab === 'onsite') {
                loadOnsite();
            }
        });
    });

    document.getElementById('bookingsDate').addEventListener('change', (e) => {
        bookingsDate = e.target.value;
        loadBookings();
    });

    document.getElementById('historyDate').addEventListener('change', (e) => {
        historyDate = e.target.value;
        loadHistory();
    });

    // Hide Completed toggle
    document.getElementById('toggleCompleted').addEventListener('click', (e) => {
        hideCompleted = !hideCompleted;
        e.target.textContent = hideCompleted ? 'Show Completed' : 'Hide Completed';
        e.target.style.background = hideCompleted ? '#dc3545' : '#555';
        loadBookings();
    });

    // Render functions
    function renderBookingsTable(data) {
      data.sort((a, b) => {
    const carrierA = a.carrier.toUpperCase();
    const carrierB = b.carrier.toUpperCase();
    if (carrierA !== carrierB) {
        return carrierA.localeCompare(carrierB);
    }
    // If carriers are the same, sort by release number
    const releaseA = a.release.toUpperCase();
    const releaseB = b.release.toUpperCase();
    return releaseA.localeCompare(releaseB);
});
        const tbody = document.getElementById('bookingsBody');
        tbody.innerHTML = '';
        data.forEach(booking => {
            if (hideCompleted && booking.completed) return;

            const tr = document.createElement('tr');
            if (booking.completed) tr.classList.add('completed-row');
            tr.innerHTML = `
                <td>${booking.release}</td>
                <td>${booking.shippingline}</td>
                <td>${booking.iso}</td>
                <td>${booking.grade}</td>
                <td>${booking.carrier}</td>
                <td style="text-align:center;"><input type="checkbox" ${booking.completed ? 'checked' : ''} disabled></td>
                <td><button class="delete-btn" data-id="${booking.id}">×</button></td>
            `;
            tr.addEventListener('click', (e) => {
                if (!e.target.classList.contains('delete-btn')) {
                    moveBookingToOnsite(booking);
                }
            });
            tbody.appendChild(tr);
        });

        document.querySelectorAll('#bookingsBody .delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                if (confirm('Are you sure you want to delete this booking?')) {
                    supabaseClient.from('bookings').delete().eq('id', id).then(() => loadBookings());
                }
            });
        });
    }

    function renderOnsiteTable(data) {
        const tbody = document.getElementById('onsiteBody');
        tbody.innerHTML = '';
        const regoCount = {};
        data.forEach(entry => regoCount[entry.rego] = (regoCount[entry.rego] || 0) + 1);

        let currentRego = null;
        let groupColor = 1;

        data.forEach(entry => {
            if (entry.rego !== currentRego) {
                currentRego = entry.rego;
                if (regoCount[entry.rego] > 1) groupColor = 3 - groupColor;
            }

            const tr = document.createElement('tr');
            if (regoCount[entry.rego] > 1) tr.classList.add(`truck-group${groupColor}`);

            const hasNumber = entry.container_number && entry.container_number.trim() !== '';
            tr.innerHTML = `
                <td>${entry.release}</td>
                <td>${entry.shippingline}</td>
                <td>${entry.iso}</td>
                <td>${entry.grade}</td>
                <td>${entry.carrier}</td>
                <td>${entry.rego}</td>
                <td>${entry.door_direction}</td>
                <td><input type="text" value="${entry.container_number || ''}" data-id="${entry.id}" class="containerInput" style="width:100%;padding:5px;"></td>
                <td>
                    <button class="completeBtn" data-id="${entry.id}" style="background:${hasNumber ? '#dc3545' : '#ccc'};" ${hasNumber ? '' : 'disabled'}>Complete</button>
                    <button class="delete-btn" data-id="${entry.id}">×</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.containerInput').forEach(input => {
            input.addEventListener('input', (e) => {
                const value = e.target.value.trim();
                const tr = e.target.closest('tr');
                const btn = tr.querySelector('.completeBtn');
                btn.disabled = value === '';
                btn.style.background = value ? '#dc3545' : '#ccc';
            });
            input.addEventListener('blur', async (e) => {
                const id = e.target.dataset.id;
                const value = e.target.value.trim();
                await supabaseClient.from('onsite').update({ container_number: value }).eq('id', id);
            });
        });

        document.querySelectorAll('.completeBtn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const { data: entry } = await supabaseClient.from('onsite').select('*').eq('id', id).single();

                await supabaseClient.from('history').insert({
                    ...entry,
                    completed_at: new Date().toLocaleString(),
                    completed_date: today
                });

                await supabaseClient.from('onsite').delete().eq('id', id);
                loadOnsite();
                if (document.getElementById('history').classList.contains('active')) loadHistory();
            });
        });

        document.querySelectorAll('#onsiteBody .delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                if (confirm('Are you sure you want to delete this on-site container?')) {
                    supabaseClient.from('onsite').delete().eq('id', id).then(() => loadOnsite());
                }
            });
        });
    }

    function renderHistoryTable(data) {
        const tbody = document.getElementById('historyBody');
        tbody.innerHTML = '';
        data.forEach(entry => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${entry.release}</td>
                <td>${entry.shippingline}</td>
                <td>${entry.iso}</td>
                <td>${entry.grade}</td>
                <td>${entry.carrier}</td>
                <td>${entry.rego}</td>
                <td>${entry.door_direction}</td>
                <td>${entry.container_number || ''}</td>
                <td>${entry.completed_at || ''}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function moveBookingToOnsite(booking) {
        document.querySelector('.tab[data-tab="onsite"]').click();
        document.getElementById('modal-release').value = booking.release;
        document.getElementById('modal-shippingline').value = booking.shippingline;
        document.getElementById('modal-iso').value = booking.iso;
        document.getElementById('modal-grade').value = booking.grade;
        document.getElementById('modal-carrier').value = booking.carrier;
        document.getElementById('modal-rego').focus();
    }

    // Auto-fill on release number blur in On Site
    document.getElementById('modal-release').addEventListener('blur', async () => {
        const rel = document.getElementById('modal-release').value.trim().toUpperCase();
        if (!rel) return;

        const { data } = await supabaseClient.from('bookings').select('*').eq('release', rel).eq('date', today).eq('completed', false).limit(1);
        if (data && data.length > 0) {
            const b = data[0];
            document.getElementById('modal-shippingline').value = b.shippingline;
            document.getElementById('modal-iso').value = b.iso;
            document.getElementById('modal-grade').value = b.grade;
            document.getElementById('modal-carrier').value = b.carrier;
        }
    });

    // Load functions (public data)
    async function loadBookings() {
        const { data } = await supabaseClient.from('bookings').select('*').eq('date', bookingsDate);
        renderBookingsTable(data || []);
    }

    async function loadOnsite() {
        const { data } = await supabaseClient.from('onsite').select('*');
        renderOnsiteTable(data || []);
    }

    async function loadHistory() {
        const { data } = await supabaseClient.from('history').select('*').eq('completed_date', historyDate);
        renderHistoryTable(data || []);
    }

    // Clear form buttons
    document.getElementById('clear-booking').addEventListener('click', () => {
        document.getElementById('bookingForm').reset();
    });

    document.getElementById('clear-onsite').addEventListener('click', () => {
        document.getElementById('onsiteForm').reset();
    });

    // Forms
    document.getElementById('bookingForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const newBooking = {
            date: bookingsDate,
            release: document.getElementById('booking-release').value.trim().toUpperCase(),
            shippingline: document.getElementById('booking-shippingline').value.trim().toUpperCase(),
            iso: document.getElementById('booking-iso').value.trim().toUpperCase(),
            grade: document.getElementById('booking-grade').value.trim().toUpperCase(),
            carrier: document.getElementById('booking-carrier').value.trim().toUpperCase(),
            completed: false
        };
        await supabaseClient.from('bookings').insert(newBooking);
        e.target.reset();
        loadBookings();
    });

    document.getElementById('onsiteForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const release = document.getElementById('modal-release').value.trim().toUpperCase();
        const newEntry = {
            release,
            shippingline: document.getElementById('modal-shippingline').value.trim().toUpperCase(),
            iso: document.getElementById('modal-iso').value.trim().toUpperCase(),
            grade: document.getElementById('modal-grade').value.trim().toUpperCase(),
            carrier: document.getElementById('modal-carrier').value.trim().toUpperCase(),
            rego: document.getElementById('modal-rego').value.trim().toUpperCase(),
            door_direction: document.getElementById('modal-doorDirection').value.trim().toUpperCase(),
            container_number: ''
        };
        await supabaseClient.from('onsite').insert(newEntry);

        const { data: match } = await supabaseClient.from('bookings').select('id').eq('release', release).eq('date', today).eq('completed', false).limit(1);
        if (match && match.length > 0) {
            await supabaseClient.from('bookings').update({ completed: true }).eq('id', match[0].id);
        }

        e.target.reset();
        loadOnsite();
        loadBookings();
    });

    // Real-time
    supabaseClient
        .channel('public-bookings')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => loadBookings())
        .subscribe();

    supabaseClient
        .channel('public-onsite')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'onsite' }, () => loadOnsite())
        .subscribe();

    supabaseClient
        .channel('public-history')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'history' }, () => loadHistory())
        .subscribe();

    // Initial load
    loadBookings();
    loadOnsite();
}
