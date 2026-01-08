const { createClient } = supabase;

const supabaseClient = createClient(
  'https://xoxbmcfsawwibxdegznv.supabase.co',
  'sb_publishable_PWIgfu7AZifTuNM-3CNlHA_D7wqFB7s'
);

let user = null;
let hideCompleted = false;
let bookingsDate = '';
let historyDate = '';
let currentOnsiteData = [];

document.addEventListener('DOMContentLoaded', () => {
    const defaultColors = {
        primary: '#007bff',
        secondary: '#6c757d',
        accent: '#28a745',
        bg: '#f4f4f4',
        text: '#333333'
    };

    function loadCustomColors() {
        if (!user) return;
        const saved = localStorage.getItem(`custom_colors_${user.id}`);
        if (saved) {
            const colors = JSON.parse(saved);
            applyColors(colors);
            updatePickerValues(colors);
        } else {
            applyColors(defaultColors);
        }
    }

    function applyColors(colors) {
        document.documentElement.style.setProperty('--color-primary', colors.primary);
        document.documentElement.style.setProperty('--color-secondary', colors.secondary);
        document.documentElement.style.setProperty('--color-accent', colors.accent);
        document.documentElement.style.setProperty('--color-bg', colors.bg);
        document.documentElement.style.setProperty('--color-text', colors.text);
    }

    function updatePickerValues(colors) {
        document.getElementById('color-primary').value = colors.primary;
        document.getElementById('color-secondary').value = colors.secondary;
        document.getElementById('color-accent').value = colors.accent;
        document.getElementById('color-bg').value = colors.bg;
        document.getElementById('color-text').value = colors.text;
    }

    ['color-primary', 'color-secondary', 'color-accent', 'color-bg', 'color-text'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                const colors = {
                    primary: document.getElementById('color-primary').value,
                    secondary: document.getElementById('color-secondary').value,
                    accent: document.getElementById('color-accent').value,
                    bg: document.getElementById('color-bg').value,
                    text: document.getElementById('color-text').value
                };
                applyColors(colors);
            });
        }
    });

    document.getElementById('save-colors')?.addEventListener('click', () => {
        if (!user) return;
        const colors = {
            primary: document.getElementById('color-primary').value,
            secondary: document.getElementById('color-secondary').value,
            accent: document.getElementById('color-accent').value,
            bg: document.getElementById('color-bg').value,
            text: document.getElementById('color-text').value
        };
        localStorage.setItem(`custom_colors_${user.id}`, JSON.stringify(colors));
        alert('Colors saved!');
    });

    document.getElementById('reset-colors')?.addEventListener('click', () => {
        if (!user) return;
        localStorage.removeItem(`custom_colors_${user.id}`);
        applyColors(defaultColors);
        updatePickerValues(defaultColors);
        alert('Colors reset!');
    });

    // Role system
    const roleSelect = document.getElementById('user-role');
    const currentRoleDisplay = document.getElementById('current-role');

    function loadRole() {
        if (!user) return 'dispatch';
        const saved = localStorage.getItem(`user_role_${user.id}`);
        return saved || 'dispatch';
    }

    function showDashboard(role) {
        document.querySelectorAll('.dashboard-view').forEach(view => view.classList.remove('active'));
        document.getElementById(`${role}-dashboard`).classList.add('active');
    }

    document.getElementById('user-role')?.addEventListener('change', function() {
        if (!user) return;
        const newRole = this.value;
        localStorage.setItem(`user_role_${user.id}`, newRole);
        currentRoleDisplay.textContent = newRole.charAt(0).toUpperCase() + newRole.slice(1);
        showDashboard(newRole);
        initApp(newRole);
    });

    // Settings panel
    document.getElementById('settingsBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('settingsPanel').classList.toggle('active');
    });

    document.querySelector('.close-settings')?.addEventListener('click', () => {
        document.getElementById('settingsPanel').classList.remove('active');
    });

    document.addEventListener('click', (e) => {
        const panel = document.getElementById('settingsPanel');
        if (panel && !panel.contains(e.target) && e.target.id !== 'settingsBtn') {
            panel.classList.remove('active');
        }
    });

    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab + '-tab').classList.add('active');
        });
    });

    // Auth
    document.getElementById('auth-btn')?.addEventListener('click', async () => {
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
            loadCustomColors();
            const role = loadRole();
            roleSelect.value = role;
            currentRoleDisplay.textContent = role.charAt(0).toUpperCase() + role.slice(1);
            showDashboard(role);
            initApp(role);
        }
    });

    supabaseClient.auth.getSession().then(({ data }) => {
        if (data.session) {
            user = data.session.user;
            document.getElementById('login-page').style.display = 'none';
            document.getElementById('dashboard').style.display = 'block';
            loadCustomColors();
            const role = loadRole();
            roleSelect.value = role;
            currentRoleDisplay.textContent = role.charAt(0).toUpperCase() + role.slice(1);
            showDashboard(role);
            initApp(role);
        }
    });

    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        location.reload();
    });

    // Global form listeners
    document.getElementById('clear-booking')?.addEventListener('click', () => {
        document.getElementById('bookingForm').reset();
    });

    document.getElementById('clear-onsite')?.addEventListener('click', () => {
        document.getElementById('onsiteForm').reset();
    });

    document.getElementById('bookingForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newBooking = {
            date: bookingsDate,
            release: document.getElementById('booking-release').value.trim().toUpperCase(),
            shippingline: document.getElementById('booking-shippingline').value.trim().toUpperCase(),
            iso: document.getElementById('booking-iso').value.trim().toUpperCase(),
            grade: document.getElementById('booking-grade').value.trim().toUpperCase(),
            carrier: document.getElementById('booking-carrier').value.trim().toUpperCase(),
            completed: false,
            note: document.getElementById('booking-note').value.trim() || null
        };
        await supabaseClient.from('bookings').insert(newBooking);
        e.target.reset();
        loadBookings();
    });

    // Onsite form listener with optimistic update
    document.getElementById('onsiteForm')?.addEventListener('submit', async (e) => {
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
            container_number: '',
            note: document.getElementById('modal-note').value.trim() || null
        };

        // Optimistic add
        const tempId = Date.now();
        const optimisticEntry = { ...newEntry, id: tempId };
        currentOnsiteData = [optimisticEntry, ...currentOnsiteData];
        renderOnsiteTable(currentOnsiteData);

        const { data, error } = await supabaseClient.from('onsite').insert(newEntry).select().single();

        if (error) {
            alert('Failed to save. Please try again.');
            currentOnsiteData = currentOnsiteData.filter(e => e.id !== tempId);
            renderOnsiteTable(currentOnsiteData);
            return;
        }

        // Replace temp with real
        currentOnsiteData = currentOnsiteData.map(e => e.id === tempId ? data : e);
        renderOnsiteTable(currentOnsiteData);

        // Add to movements
        await supabaseClient.from('movements').insert({
            carrier: newEntry.carrier,
            rego: newEntry.rego,
            shippingline: newEntry.shippingline,
            iso: newEntry.iso,
            grade: newEntry.grade,
            container_number: '',
            direction: 'outwards'
        });

        // Mark booking completed
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' });
        const { data: match } = await supabaseClient.from('bookings')
            .select('id')
            .eq('release', release)
            .eq('date', today)
            .eq('completed', false)
            .limit(1);

        if (match && match.length > 0) {
            await supabaseClient.from('bookings').update({ completed: true }).eq('id', match[0].id);
        }

        e.target.reset();
        loadBookings();
    });

    async function initApp(role = 'dispatch') {
        const todayFull = new Date().toLocaleDateString('en-US', {
            timeZone: 'Pacific/Auckland',
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        document.getElementById('dateLabel').textContent = `Today: ${todayFull}`;

        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' });

        if (!bookingsDate) bookingsDate = today;
        if (!historyDate) historyDate = today;

        const bookingsPicker = document.getElementById('bookingsDate');
        const historyPicker = document.getElementById('historyDate');
        if (bookingsPicker) bookingsPicker.value = bookingsDate;
        if (historyPicker) historyPicker.value = historyDate;

        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const parentTabs = tab.closest('.tabs');
                if (!parentTabs) return;
                parentTabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const targetId = tab.dataset.tab;
                const parentView = tab.closest('.dashboard-view');
                parentView.querySelectorAll('.content').forEach(c => c.classList.remove('active'));
                document.getElementById(targetId).classList.add('active');

                const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' });
                if (targetId === 'bookings') {
                    if (bookingsPicker) bookingsPicker.value = today;
                    bookingsDate = today;
                    loadBookings();
                } else if (targetId === 'history') {
                    if (historyPicker) historyPicker.value = today;
                    historyDate = today;
                    loadHistory();
                } else if (targetId === 'onsite') {
                    loadOnsite();
                }
            });
        });

        if (bookingsPicker) {
            bookingsPicker.addEventListener('change', (e) => {
                bookingsDate = e.target.value;
                loadBookings();
            });
        }

        if (historyPicker) {
            historyPicker.addEventListener('change', (e) => {
                historyDate = e.target.value;
                loadHistory();
            });
        }

        if (role === 'driver') {
            loadMovements();
            return;
        }

        if (role !== 'dispatch') return;

        document.getElementById('toggleCompleted')?.addEventListener('click', (e) => {
            hideCompleted = !hideCompleted;
            e.target.textContent = hideCompleted ? 'Show Completed' : 'Hide Completed';
            e.target.style.background = hideCompleted ? '#dc3545' : '#555';
            loadBookings();
        });

        function renderBookingsTable(data) {
            // ... your existing renderBookingsTable ...
        }

        function renderOnsiteTable(data) {
            // ... your existing renderOnsiteTable ...
        }

        function renderHistoryTable(data) {
            // ... your existing renderHistoryTable ...
        }

        function moveBookingToOnsite(booking) {
            // ... your existing moveBookingToOnsite ...
        }

        document.getElementById('modal-release').addEventListener('blur', async () => {
            // ... your existing blur listener ...
        });

        async function loadBookings() {
            const { data } = await supabaseClient.from('bookings').select('*').eq('date', bookingsDate);
            renderBookingsTable(data || []);
        }

        async function loadOnsite() {
            const { data } = await supabaseClient.from('onsite').select('*');
            currentOnsiteData = data || [];
            renderOnsiteTable(currentOnsiteData);
        }

        async function loadHistory() {
            const { data } = await supabaseClient.from('history').select('*').eq('completed_date', historyDate);
            renderHistoryTable(data || []);
        }

        async function loadMovements() {
            const { data } = await supabaseClient.from('movements').select('*').order('created_at', { ascending: false });
            const container = document.getElementById('movements-container');
            if (!container) return;
            container.innerHTML = '';
            if (data.length === 0) {
                container.innerHTML = '<p style="text-align:center; color:#666;">No movements yet.</p>';
                return;
            }
            data.forEach(entry => {
                const div = document.createElement('div');
                div.classList.add('movement-entry', entry.direction);
                let infoHTML = '';
                if (entry.direction === 'inwards') {
                    infoHTML = `
                        <div class="movement-info">
                            <p><strong>Carrier:</strong> ${entry.carrier || 'N/A'}</p>
                            <p><strong>Rego:</strong> ${entry.rego || 'N/A'}</p>
                            <p><strong>Container Number:</strong> ${entry.container_number || 'N/A'}</p>
                        </div>
                        <button class="complete-btn" data-id="${entry.id}">Complete</button>
                    `;
                } else {
                    infoHTML = `
                        <div class="movement-info">
                            <p><strong>Carrier:</strong> ${entry.carrier || 'N/A'}</p>
                            <p><strong>Rego:</strong> ${entry.rego || 'N/A'}</p>
                            <p><strong>Shipping Line:</strong> ${entry.shippingline || 'N/A'}</p>
                            <p><strong>ISO:</strong> ${entry.iso || 'N/A'}</p>
                            <p><strong>Grade:</strong> ${entry.grade || 'N/A'}</p>
                            <p><strong>Container Number:</strong> ${entry.container_number || 'N/A'}</p>
                        </div>
                        <button class="complete-btn" data-id="${entry.id}">Complete</button>
                    `;
                }
                div.innerHTML = infoHTML;
                container.appendChild(div);
            });
            document.querySelectorAll('.complete-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.dataset.id;
                    await supabaseClient.from('movements').delete().eq('id', id);
                    loadMovements();
                });
            });
        }

        // Real-time
        supabaseClient.channel('public-bookings').on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => loadBookings()).subscribe();
        supabaseClient.channel('public-onsite').on('postgres_changes', { event: '*', schema: 'public', table: 'onsite' }, () => loadOnsite()).subscribe();
        supabaseClient.channel('public-history').on('postgres_changes', { event: '*', schema: 'public', table: 'history' }, () => loadHistory()).subscribe();
        supabaseClient.channel('public-movements').on('postgres_changes', { event: '*', schema: 'public', table: 'movements' }, () => loadMovements()).subscribe();

        // Initial load
        loadBookings();
        loadOnsite();
        loadHistory();
        if (role === 'driver') loadMovements();
    }
});
