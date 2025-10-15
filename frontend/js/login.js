document.addEventListener('DOMContentLoaded', function() {
    console.log('Login page cargada');
    
    // Verificar si ya está autenticado
    if (localStorage.getItem('token')) {
        console.log('Usuario ya autenticado, redirigiendo...');
        window.location.href = 'dashboard.html';
        return;
    }

    // Elementos del DOM
    const loginForm = document.getElementById('loginForm');
    const loginAlert = document.getElementById('loginAlert');
    const loginErrorMessage = document.getElementById('loginErrorMessage');
    const loginBtn = document.getElementById('loginBtn');
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');

    // Función para validar email
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Mostrar usuarios de prueba
    showTestUsers();

    // Toggle contraseña
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function() {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            const icon = this.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-eye');
                icon.classList.toggle('fa-eye-slash');
            }
        });
    }

    // Manejar envío del formulario
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            console.log('Formulario enviado');
            
            const formData = new FormData(this);
            const email = formData.get('email');
            const password = formData.get('password');

            // Validaciones
            if (!email || !password) {
                showAlert('Por favor, completa todos los campos');
                return;
            }

            if (!isValidEmail(email)) {
                showAlert('Email inválido');
                return;
            }

            try {
                setLoginButtonState(true);
                hideAlert();

                console.log('Enviando login para:', email);
                console.log('URL API:', CONFIG.API_URL);

                // Hacer petición directa
                const response = await fetch(`${CONFIG.API_URL}/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email, password })
                });

                console.log('Response status:', response.status);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Error response:', errorText);
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();
                console.log('Login response:', data);

                if (data.success) {
                    console.log('Login exitoso');
                    
                    // Guardar datos
                    localStorage.setItem('token', data.data.token);
                    localStorage.setItem('user', JSON.stringify(data.data.user));
                    
                    // Mostrar éxito y redirigir
                    showSuccessAlert('¡Login exitoso! Redirigiendo...');
                    
                    // Redirigir después de 1 segundo
                    setTimeout(() => {
                        console.log('Redirigiendo a dashboard...');
                        window.location.href = 'dashboard.html';
                    }, 1000);
                    
                } else {
                    throw new Error(data.error || 'Error en login');
                }

            } catch (error) {
                console.error('Login error:', error);
                showAlert(error.message || 'Error de conexión');
            } finally {
                setLoginButtonState(false);
            }
        });
    }

    // Funciones auxiliares
    function showAlert(message) {
        if (loginErrorMessage && loginAlert) {
            loginErrorMessage.textContent = message;
            loginAlert.classList.remove('d-none', 'alert-success');
            loginAlert.classList.add('alert-danger');
        }
    }

    function showSuccessAlert(message) {
        if (loginErrorMessage && loginAlert) {
            loginErrorMessage.textContent = message;
            loginAlert.classList.remove('d-none', 'alert-danger');
            loginAlert.classList.add('alert-success');
        }
    }

    function hideAlert() {
        if (loginAlert) {
            loginAlert.classList.add('d-none');
        }
    }

    function setLoginButtonState(loading) {
        if (!loginBtn) return;
        
        if (loading) {
            loginBtn.disabled = true;
            loginBtn.innerHTML = `
                <span class="spinner-border spinner-border-sm me-2"></span>
                Iniciando sesión...
            `;
        } else {
            loginBtn.disabled = false;
            loginBtn.innerHTML = `
                <i class="fas fa-sign-in-alt me-2"></i>
                Iniciar Sesión
            `;
        }
    }

    function showTestUsers() {
        const testContainer = document.getElementById('testUsers');
        if (testContainer) {
            testContainer.style.display = 'block';
            testContainer.innerHTML = `
                <div class="card bg-light">
                    <div class="card-body">
                        <h6 class="card-title">
                            <i class="fas fa-users me-2"></i>
                            Usuarios de Prueba
                        </h6>
                        <div class="row g-2">
                            <div class="col-md-6">
                                <button type="button" class="btn btn-sm btn-outline-primary w-100 test-user" 
                                        data-email="admin@sistema.com"
                                        data-password="admin123">
                                    <i class="fas fa-user-shield me-1"></i>
                                    Admin
                                </button>
                            </div>
                            <div class="col-md-6">
                                <button type="button" class="btn btn-sm btn-outline-success w-100 test-user" 
                                        data-email="direcciongeneral@cielitohome.com"
                                        data-password="cielito2025">
                                    <i class="fas fa-user-tie me-1"></i>
                                    Director
                                </button>
                            </div>
                            <div class="col-md-6">
                                <button type="button" class="btn btn-sm btn-outline-info w-100 test-user" 
                                        data-email="compras@cielitohome.com"
                                        data-password="cielito2025">
                                    <i class="fas fa-shopping-cart me-1"></i>
                                    Compras
                                </button>
                            </div>
                            <div class="col-md-6">
                                <button type="button" class="btn btn-sm btn-outline-warning w-100 test-user" 
                                        data-email="sistemas@cielitohome.com"
                                        data-password="cielito2025">
                                    <i class="fas fa-user me-1"></i>
                                    Solicitante
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Event listeners para botones de prueba
            document.querySelectorAll('.test-user').forEach(button => {
                button.addEventListener('click', function() {
                    const email = this.getAttribute('data-email');
                    const password = this.getAttribute('data-password');
                    
                    document.getElementById('email').value = email;
                    document.getElementById('password').value = password;
                    hideAlert();
                });
            });
        }
    }

    // Auto-focus
    const emailInput = document.getElementById('email');
    if (emailInput) {
        emailInput.focus();
    }
});