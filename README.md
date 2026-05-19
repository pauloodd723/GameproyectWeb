# Gem Survival Run

Juego 3D de supervivencia en navegador. El jugador recorre 5 niveles distintos recolectando esmeraldas mientras escapa de zombies. Construido con Three.js + React en el frontend y Node.js + MySQL en el backend.

---

## Funcionalidades implementadas

### 5 Niveles con escenarios 3D
Cada nivel tiene su propio escenario modelado en Blender (archivos `.blend` en `game-project/public/`). Los bloques, monedas y portales de cada nivel se cargan desde la API del backend o desde el archivo local `public/data/toy_car_blocks.json` si el backend no está disponible.

### Teletransporte entre niveles
Al recoger la gema final (portal) de cada nivel, el juego limpia la escena actual y carga el siguiente nivel automáticamente. El personaje se reposiciona en el punto de spawn correspondiente a ese nivel.

### HUD con puntuación global y por partida
El HUD muestra en tiempo real:
- Nivel actual y total de niveles
- Puntos recogidos en el nivel actual
- Puntos globales acumulados en todas las partidas (persistidos en base de datos)
- Tiempo transcurrido
- Contador de muertes

### Ajuste de personaje, enemigos y monedas
- El personaje tiene física de esfera con animaciones (idle, caminar, saltar, morir, bailar)
- Los enemigos (zombies) escalan en velocidad y cantidad por nivel: 2 en nivel 1 hasta 10 en nivel 5
- Las monedas/esmeraldas giran y emiten partículas verdes; al recogerlas se activa un efecto visual y sonoro

### Correr con Shift
Mantener `Shift` mientras el personaje se mueve duplica su velocidad (de 6 a 12 unidades/seg).

### El fox sigue al jugador
Un modelo de zorro (Fox) acompaña al personaje durante toda la partida siguiendo su posición en la escena.

### Carteles decorativos por nivel
Dos carteles 3D generados con Canvas API aparecen al lado de cada gema de cada nivel. Muestran información contextual (objetivos, advertencias, consejos). Se limpian y regeneran correctamente al cambiar de nivel sin dejar memoria sin liberar.

### Autenticación con JSON Web Token
El backend genera un JWT al hacer login o registro. El token viaja en una cookie HttpOnly. El middleware verifica el token en todas las rutas protegidas de la API.

### Modo invitado — login sin backend
En la pantalla de login hay un botón **Jugar sin cuenta** que permite entrar al juego sin necesidad de que el backend esté activo. El progreso no se guarda, pero el juego funciona completo usando los datos locales.

### Publicación en Vercel
El frontend está preparado para desplegarse en Vercel de forma independiente al backend. Si el backend no responde, todos los fetch de la API fallan silenciosamente y el juego carga los niveles desde los archivos locales en `public/data/`.

---

## Estructura del proyecto

```
GameproyectWeb/
├── backend/                         # API REST — Node.js + Express
│   ├── app.js                       # Servidor principal
│   ├── config/
│   │   └── mysql.js                 # Conexión MySQL y creación automática de tablas
│   ├── controllers/
│   │   ├── authController.js        # Registro, login y logout con JWT
│   │   └── gameController.js        # Sesiones, monedas, muertes y estadísticas
│   ├── middleware/
│   │   └── auth.js                  # Verificación del JWT en rutas protegidas
│   └── routes/                      # Rutas de autenticación y juego
│
└── game-project/                    # Frontend — React + Three.js (Vite)
    ├── public/
    │   ├── data/
    │   │   └── toy_car_blocks.json  # Bloques de todos los niveles (fallback local)
    │   ├── config/
    │   │   └── precisePhysicsModels.json
    │   ├── models/                  # Modelos 3D GLB/GLTF
    │   ├── sounds/                  # Audio del juego
    │   └── textures/                # Texturas baked y carteles
    └── src/
        ├── App.jsx                  # HUD principal y gestión de estado React
        ├── components/
        │   └── LoginScreen.jsx      # Pantalla de login/registro/modo invitado
        ├── Experience/
        │   └── World/
        │       ├── World.js         # Lógica principal: puntos, colisiones, niveles
        │       ├── Robot.js         # Personaje jugador con física y animaciones
        │       ├── Enemy.js         # Zombies con IA de persecución por nivel
        │       ├── Prize.js         # Gemas y portal final con partículas
        │       ├── LevelManager.js  # Gestión de los 5 niveles y spawn points
        │       └── BillboardSystem.js  # Carteles 3D generados con Canvas API
        ├── loaders/
        │   └── ToyCarLoader.js      # Carga bloques desde API o archivo local
        └── styles/
            ├── GameUI.css           # Estilos del HUD
            └── loader.css           # Pantalla de carga
```

---

## Instalación y configuración

### Requisitos

- Node.js 18 o superior
- MySQL 8 con MySQL Workbench
- Git

---

### 1. Clonar el repositorio

```bash
git clone https://github.com/pauloodd723/GameproyectWeb.git
cd GameproyectWeb
```

---

### 2. Configurar la base de datos en MySQL Workbench

Abre MySQL Workbench, conéctate a tu servidor local y ejecuta:

```sql
CREATE DATABASE gameproject;
```

Las tablas se crean automáticamente cuando el backend inicia por primera vez. No es necesario ejecutar ningún script SQL adicional.

---

### 3. Configurar el backend

Crea el archivo `backend/.env`:

```env
DB_APP_HOST=127.0.0.1
DB_APP_PORT=3306
DB_APP_USER=root
DB_APP_PASS=tu_contraseña_mysql
DB_APP_NAME=gameproject
JWT_SECRET=una_clave_secreta_larga_y_segura
PORT=3001
FRONTEND_URL=http://localhost:5173
```

Ajusta `DB_APP_USER` y `DB_APP_PASS` con las credenciales de tu MySQL Workbench.

Instalar dependencias e iniciar:

```bash
cd backend
npm install
node app.js
```

Al iniciar, el backend se conecta a MySQL y crea las tablas `users`, `player_stats`, `game_sessions` y `coin_logs`. El servidor queda escuchando en `http://localhost:3001`.

---

### 4. Configurar el frontend

Crea el archivo `game-project/.env`:

```env
VITE_BACKEND_URL=http://localhost:3001
VITE_API_URL=http://localhost:3001
```

Instalar dependencias e iniciar:

```bash
cd game-project
npm install
npm run dev
```

El frontend queda disponible en `http://localhost:5173`.

---

## Despliegue en Vercel

El frontend se despliega de forma independiente. El backend no es necesario para que el juego funcione en Vercel gracias al modo invitado y al fallback de datos locales.

1. Sube el repositorio a GitHub.
2. En Vercel, importa el proyecto y configura:
   - **Root Directory:** `game-project`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Agrega las variables de entorno en Vercel (opcionales si no tienes backend desplegado):
   - `VITE_BACKEND_URL` → URL de tu backend desplegado
   - `VITE_API_URL` → misma URL del backend
4. Despliega. Los jugadores sin cuenta pueden usar el botón **Jugar sin cuenta** y el juego carga todos los niveles desde los archivos locales.

---

## Tablas de la base de datos

| Tabla | Descripción |
|---|---|
| `users` | Usuarios registrados con contraseña hasheada con bcrypt |
| `player_stats` | Puntos globales, muertes totales e intentos por jugador |
| `game_sessions` | Registro de cada partida: nivel, monedas recogidas y estado |
| `coin_logs` | Historial de cada esmeralda recogida por sesión y nivel |

---

## Rutas de la API

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/register` | Registrar nuevo usuario |
| POST | `/api/auth/login` | Iniciar sesión, devuelve JWT en cookie |
| GET | `/api/auth/me` | Verificar sesión activa |
| POST | `/api/auth/logout` | Cerrar sesión |
| POST | `/api/game/session/start` | Crear nueva sesión de juego |
| POST | `/api/game/coin` | Registrar esmeralda recogida |
| POST | `/api/game/death` | Registrar muerte del jugador |
| POST | `/api/game/level-complete` | Marcar nivel como completado |
| GET | `/api/game/stats` | Obtener estadísticas del jugador |
| GET | `/api/blocks?level=N` | Cargar bloques del nivel N |

---

## Tecnologías

| Area | Tecnologia |
|---|---|
| Renderizado 3D | Three.js 0.175 |
| Fisica | Cannon-es |
| UI | React 19 |
| Bundler | Vite 6 |
| Animaciones | GSAP |
| Audio | Howler.js |
| Backend | Node.js + Express 5 |
| Base de datos | MySQL 8 — mysql2 |
| Autenticacion | JSON Web Token + bcryptjs |
| Despliegue frontend | Vercel |
