// Telegram Mini App Configuration
const tg = window.Telegram.WebApp;
tg.expand();

// App State
let appState = {
    isLoggedIn: false,
    employee: null,
    token: null,
    currentLocation: null,
    qrData: null,
    attendanceStatus: {
        checkedIn: false,
        checkInTime: null,
        checkOutTime: null
    }
};

// API Configuration
const API_BASE_URL = 'https://16b03ba1c0e2.ngrok-free.app/api';

// Initialize App
class AttendanceApp {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateDateTime();
        this.checkLoginStatus();
        
        // Update time every minute
        setInterval(() => this.updateDateTime(), 60000);
    }

    setupEventListeners() {
        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Dashboard buttons
        document.getElementById('checkInBtn').addEventListener('click', () => {
            this.startCheckIn();
        });

        document.getElementById('checkOutBtn').addEventListener('click', () => {
            this.startCheckOut();
        });

        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.handleLogout();
        });

        // Scanner buttons
        document.getElementById('cancelScanBtn').addEventListener('click', () => {
            this.showScreen('dashboardScreen');
            this.stopQRScanner();
        });

        // Location buttons
        document.getElementById('allowLocationBtn').addEventListener('click', () => {
            this.requestLocation();
        });

        document.getElementById('cancelLocationBtn').addEventListener('click', () => {
            this.showScreen('dashboardScreen');
        });
    }

    // Screen Management
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }

    showLoading(message = 'Processing...') {
        document.getElementById('loadingMessage').textContent = message;
        this.showScreen('loadingScreen');
    }

    hideLoading() {
        // Will be handled by showScreen calls
    }

    // Message Display
    showMessage(message, type = 'info') {
        const messageContainer = document.getElementById('messageContainer');
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;
        messageElement.textContent = message;
        
        messageContainer.appendChild(messageElement);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            messageElement.remove();
        }, 5000);
    }

    // Date/Time Updates
    updateDateTime() {
        const now = new Date();
        const dateTimeString = now.toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const dateTimeElement = document.getElementById('currentDateTime');
        if (dateTimeElement) {
            dateTimeElement.textContent = dateTimeString;
        }
    }

    // Authentication
    async handleLogin() {
        const employeeCode = document.getElementById('employeeCode').value.trim();
        const employeePhone = document.getElementById('employeePhone').value.trim();

        if (!employeeCode || !employeePhone) {
            this.showMessage('Please fill in all fields', 'error');
            return;
        }

        this.showLoading('Logging in...');

        try {
            const response = await fetch(`${API_BASE_URL}/auth/employee-login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    code: employeeCode,
                    phone: employeePhone
                })
            });

            const data = await response.json();

            if (response.ok) {
                appState.isLoggedIn = true;
                appState.employee = data.employee;
                appState.token = data.token;
                
                // Save to localStorage
                localStorage.setItem('employee_token', data.token);
                localStorage.setItem('employee_data', JSON.stringify(data.employee));
                
                this.showDashboard();
                this.showMessage('Login successful!', 'success');
            } else {
                this.showMessage(data.message || 'Login failed', 'error');
                this.showScreen('loginScreen');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showMessage('Network error. Please try again.', 'error');
            this.showScreen('loginScreen');
        }
    }

    checkLoginStatus() {
        const token = localStorage.getItem('employee_token');
        const employeeData = localStorage.getItem('employee_data');

        if (token && employeeData) {
            appState.isLoggedIn = true;
            appState.token = token;
            appState.employee = JSON.parse(employeeData);
            this.showDashboard();
        } else {
            this.showScreen('loginScreen');
        }
    }

    showDashboard() {
        document.getElementById('employeeName').textContent = appState.employee.full_name;
        this.updateAttendanceStatus();
        this.showScreen('dashboardScreen');
    }

    handleLogout() {
        appState.isLoggedIn = false;
        appState.employee = null;
        appState.token = null;
        appState.attendanceStatus = {
            checkedIn: false,
            checkInTime: null,
            checkOutTime: null
        };
        
        localStorage.removeItem('employee_token');
        localStorage.removeItem('employee_data');
        
        this.showScreen('loginScreen');
        this.showMessage('Logged out successfully', 'info');
    }

    // Attendance Status
    updateAttendanceStatus() {
        const checkInElement = document.getElementById('checkInTime');
        const checkOutElement = document.getElementById('checkOutTime');
        const checkInBtn = document.getElementById('checkInBtn');
        const checkOutBtn = document.getElementById('checkOutBtn');

        if (appState.attendanceStatus.checkedIn) {
            checkInElement.textContent = `Checked in at ${appState.attendanceStatus.checkInTime}`;
            checkInElement.style.background = '#d4edda';
            checkInElement.style.color = '#155724';
            
            checkInBtn.disabled = true;
            checkOutBtn.disabled = false;
            
            if (appState.attendanceStatus.checkOutTime) {
                checkOutElement.textContent = `Checked out at ${appState.attendanceStatus.checkOutTime}`;
                checkOutElement.style.background = '#d4edda';
                checkOutElement.style.color = '#155724';
                checkOutBtn.disabled = true;
            }
        } else {
            checkInElement.textContent = 'Not checked in';
            checkOutElement.textContent = 'Not checked out';
            checkInBtn.disabled = false;
            checkOutBtn.disabled = true;
        }
    }

    // Check-in Process
    startCheckIn() {
        this.showScreen('scannerScreen');
        this.startQRScanner('checkin');
    }

    startCheckOut() {
        this.showScreen('scannerScreen');
        this.startQRScanner('checkout');
    }

    // QR Scanner
    startQRScanner(type) {
        const qrReader = new Html5Qrcode("qrReader");
        
        qrReader.start(
            { facingMode: "environment" },
            {
                fps: 10,
                qrbox: { width: 250, height: 250 }
            },
            (decodedText, decodedResult) => {
                // QR code successfully scanned
                qrReader.stop();
                this.handleQRScan(decodedText, type);
            },
            (errorMessage) => {
                // QR code scan error (can be ignored for most cases)
            }
        ).catch(err => {
            console.error('QR Scanner error:', err);
            this.showMessage('Camera access denied or not available', 'error');
            this.showScreen('dashboardScreen');
        });
        
        this.qrReader = qrReader;
    }

    stopQRScanner() {
        if (this.qrReader) {
            this.qrReader.stop().catch(err => console.error('Stop scanner error:', err));
        }
    }

    handleQRScan(qrData, type) {
        try {
            const qrInfo = JSON.parse(qrData);
            appState.qrData = qrInfo;
            
            document.getElementById('scannerResult').innerHTML = `
                <p><strong>QR Code Scanned Successfully!</strong></p>
                <p>Location: ${qrInfo.location || 'Unknown'}</p>
                <p>Requesting location permission...</p>
            `;
            
            // Request location after QR scan
            setTimeout(() => {
                this.showScreen('locationScreen');
            }, 2000);
            
        } catch (error) {
            console.error('QR parse error:', error);
            this.showMessage('Invalid QR code format', 'error');
            this.showScreen('dashboardScreen');
        }
    }

    // Location Services
    requestLocation() {
        this.showLoading('Getting your location...');
        
        if (!navigator.geolocation) {
            this.showMessage('Geolocation is not supported by this browser', 'error');
            this.showScreen('dashboardScreen');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                appState.currentLocation = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                };
                
                // Proceed with attendance after getting location
                this.processAttendance();
            },
            (error) => {
                console.error('Location error:', error);
                this.showMessage('Unable to get your location. Please try again.', 'error');
                this.showScreen('dashboardScreen');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000
            }
        );
    }

    // Attendance Processing
    async processAttendance() {
        if (!appState.qrData || !appState.currentLocation) {
            this.showMessage('Missing QR code or location data', 'error');
            this.showScreen('dashboardScreen');
            return;
        }

        const now = new Date();
        const currentTime = now.toTimeString().split(' ')[0]; // HH:MM:SS format
        
        const attendanceData = {
            scan_time: currentTime,
            tg_id: tg.initDataUnsafe?.user?.id?.toString() || 'test_tg_id',
            hash: appState.qrData.hash,
            lat_lon: appState.qrData.lat_lon,
            ipv4: await this.getClientIP(),
            current_lat_lon: `${appState.currentLocation.latitude},${appState.currentLocation.longitude}`
        };

        // Determine if this is check-in or check-out
        const endpoint = appState.attendanceStatus.checkedIn ? 'check-out' : 'check-in';
        const action = appState.attendanceStatus.checkedIn ? 'Checking out' : 'Checking in';
        
        this.showLoading(`${action}...`);

        try {
            const response = await fetch(`${API_BASE_URL}/attendance/${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${appState.token}`
                },
                body: JSON.stringify(attendanceData)
            });

            const data = await response.json();

            if (response.ok) {
                if (endpoint === 'check-in') {
                    appState.attendanceStatus.checkedIn = true;
                    appState.attendanceStatus.checkInTime = currentTime;
                    this.showMessage('Check-in successful!', 'success');
                } else {
                    appState.attendanceStatus.checkOutTime = currentTime;
                    this.showMessage('Check-out successful!', 'success');
                }
                
                this.updateAttendanceStatus();
                this.showScreen('dashboardScreen');
            } else {
                this.showMessage(data.message || `${action} failed`, 'error');
                this.showScreen('dashboardScreen');
            }
        } catch (error) {
            console.error('Attendance error:', error);
            this.showMessage('Network error. Please try again.', 'error');
            this.showScreen('dashboardScreen');
        }
    }

    // Utility Functions
    async getClientIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            console.error('IP fetch error:', error);
            return '127.0.0.1'; // Fallback IP
        }
    }

    // Telegram WebApp Integration
    setupTelegramWebApp() {
        // Set up Telegram WebApp theme
        tg.setHeaderColor('bg_color');
        tg.setBackgroundColor('bg_color');
        
        // Handle back button
        tg.BackButton.onClick(() => {
            const activeScreen = document.querySelector('.screen.active');
            if (activeScreen) {
                switch (activeScreen.id) {
                    case 'scannerScreen':
                    case 'locationScreen':
                        this.showScreen('dashboardScreen');
                        break;
                    case 'dashboardScreen':
                        if (appState.isLoggedIn) {
                            this.handleLogout();
                        }
                        break;
                    default:
                        tg.close();
                }
            }
        });

        // Show back button when not on login screen
        if (appState.isLoggedIn) {
            tg.BackButton.show();
        }

        // Handle main button if needed
        tg.MainButton.onClick(() => {
            // Can be used for primary actions
        });
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.attendanceApp = new AttendanceApp();
    
    // Setup Telegram WebApp features
    if (window.Telegram && window.Telegram.WebApp) {
        window.attendanceApp.setupTelegramWebApp();
    }
});

// Handle app visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        // Refresh time when app becomes visible
        if (window.attendanceApp) {
            window.attendanceApp.updateDateTime();
        }
    }
});

// Handle orientation changes
window.addEventListener('orientationchange', () => {
    setTimeout(() => {
        if (window.attendanceApp) {
            window.attendanceApp.updateDateTime();
        }
    }, 100);
});

// Export for debugging
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AttendanceApp;
}
