import { useState } from 'react'
import './LoginScreen.css'

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

const passwordPolicy = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/

export default function LoginScreen({ onLogin }) {
    const [tab, setTab] = useState('login')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const [loginForm, setLoginForm] = useState({ username: '', password: '' })
    const [registerForm, setRegisterForm] = useState({ username: '', password: '', repeatPassword: '' })

    function clearMessages() {
        setError('')
        setSuccess('')
    }

    function switchTab(t) {
        setTab(t)
        clearMessages()
    }

    async function handleLogin(e) {
        e.preventDefault()
        clearMessages()

        if (!loginForm.username || !loginForm.password) {
            setError('Completa todos los campos')
            return
        }

        setLoading(true)
        try {
            const res = await fetch(`${BACKEND}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(loginForm),
            })
            const data = await res.json()

            if (!res.ok) {
                setError(data.error || 'Error al iniciar sesión')
                return
            }

            // El JWT viaja como cookie HttpOnly — aquí solo guardamos el nombre
            localStorage.setItem('gameUsername', data.username)
            onLogin({ username: data.username })
        } catch {
            setError('No se pudo conectar con el servidor')
        } finally {
            setLoading(false)
        }
    }

    async function handleRegister(e) {
        e.preventDefault()
        clearMessages()

        const { username, password, repeatPassword } = registerForm

        if (!username || !password || !repeatPassword) {
            setError('Completa todos los campos')
            return
        }

        if (username.trim().length < 3) {
            setError('El usuario debe tener al menos 3 caracteres')
            return
        }

        if (password !== repeatPassword) {
            setError('Las contraseñas no coinciden')
            return
        }

        if (!passwordPolicy.test(password)) {
            setError('La contraseña necesita mínimo 8 caracteres, una mayúscula, un número y un símbolo')
            return
        }

        setLoading(true)
        try {
            const res = await fetch(`${BACKEND}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(registerForm),
            })
            const data = await res.json()

            if (!res.ok) {
                setError(data.error || 'Error al registrar')
                return
            }

            setSuccess('¡Personaje creado! Ahora inicia sesión.')
            setRegisterForm({ username: '', password: '', repeatPassword: '' })
            setTimeout(() => switchTab('login'), 1500)
        } catch {
            setError('No se pudo conectar con el servidor')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="login-screen">
            <div className="login-bg-overlay" />

            <div className="login-header">
                <div className="login-icon">🧟</div>
                <h1 className="login-title">Gem Survival Run</h1>
                <p className="login-subtitle">
                    Recoge esmeraldas · Escapa de los zombies · Sobrevive
                </p>
            </div>

            <div className="login-card">
                <div className="login-tabs">
                    <button
                        className={`login-tab${tab === 'login' ? ' active' : ''}`}
                        onClick={() => switchTab('login')}
                    >
                        ⚔️ Iniciar sesión
                    </button>
                    <button
                        className={`login-tab${tab === 'register' ? ' active' : ''}`}
                        onClick={() => switchTab('register')}
                    >
                        🪓 Crear personaje
                    </button>
                </div>

                {error && <div className="login-error">⚠️ {error}</div>}
                {success && <div className="login-success">✅ {success}</div>}

                {tab === 'login' ? (
                    <form className="login-form" onSubmit={handleLogin}>
                        <div className="form-field">
                            <label>Nombre de personaje</label>
                            <input
                                type="text"
                                placeholder="Tu nombre en el mundo"
                                value={loginForm.username}
                                onChange={e => setLoginForm(f => ({ ...f, username: e.target.value }))}
                                autoComplete="username"
                            />
                        </div>
                        <div className="form-field">
                            <label>Contraseña</label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={loginForm.password}
                                onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
                                autoComplete="current-password"
                            />
                        </div>
                        <button className="login-btn" type="submit" disabled={loading}>
                            {loading ? 'Cargando mundo...' : '⚔️ Entrar al mundo'}
                        </button>
                    </form>
                ) : (
                    <form className="login-form" onSubmit={handleRegister}>
                        <div className="form-field">
                            <label>Nombre de personaje</label>
                            <input
                                type="text"
                                placeholder="Elige tu nombre"
                                value={registerForm.username}
                                onChange={e => setRegisterForm(f => ({ ...f, username: e.target.value }))}
                                autoComplete="username"
                            />
                        </div>
                        <div className="form-field">
                            <label>Contraseña</label>
                            <input
                                type="password"
                                placeholder="Contraseña segura"
                                value={registerForm.password}
                                onChange={e => setRegisterForm(f => ({ ...f, password: e.target.value }))}
                                autoComplete="new-password"
                            />
                            <span className="password-hint">
                                Mín. 8 caracteres · Una mayúscula · Un número · Un símbolo
                            </span>
                        </div>
                        <div className="form-field">
                            <label>Confirmar contraseña</label>
                            <input
                                type="password"
                                placeholder="Repite la contraseña"
                                value={registerForm.repeatPassword}
                                onChange={e => setRegisterForm(f => ({ ...f, repeatPassword: e.target.value }))}
                                autoComplete="new-password"
                            />
                        </div>
                        <button className="login-btn" type="submit" disabled={loading}>
                            {loading ? 'Creando personaje...' : '🪓 Crear personaje'}
                        </button>
                    </form>
                )}

                <div className="login-switch">
                    {tab === 'login' ? (
                        <>¿Primera vez aquí?<button onClick={() => switchTab('register')}>Crea tu personaje</button></>
                    ) : (
                        <>¿Ya tienes personaje?<button onClick={() => switchTab('login')}>Inicia sesión</button></>
                    )}
                </div>
            </div>

            <div className="login-guest-section">
                <div className="login-guest-divider"><span>o</span></div>
                <button
                    className="login-guest-btn"
                    onClick={() => onLogin({ username: 'Invitado', guest: true })}
                >
                    🎮 Jugar sin cuenta
                </button>
                <p className="login-guest-hint">Sin registro · Sin backend · El progreso no se guarda</p>
            </div>

            <p className="login-footer">
                Los zombies no esperan — ¿estás listo para sobrevivir?
            </p>
        </div>
    )
}
