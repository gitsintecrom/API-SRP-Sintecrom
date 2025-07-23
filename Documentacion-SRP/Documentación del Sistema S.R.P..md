### 1. Introducción y Arquitectura General

Este documento describe la arquitectura y el funcionamiento del sistema migrado desde una aplicación de escritorio .NET a una aplicación web moderna. El objetivo de la migración fue modernizar la tecnología, mejorar la mantenibilidad y centralizar la lógica de negocio.

La arquitectura se compone de tres capas principales:

1. **Base de Datos (SQL Server):** La base de datos original, RegistracionNET, se mantiene como la única fuente de verdad. La nueva aplicación **no contiene lógica de negocio SQL**, sino que consume exclusivamente los **Stored Procedures (SPs)** ya existentes.
    
2. **Backend / API (Node.js & Express):** Un servidor que actúa como intermediario. Su única responsabilidad es recibir peticiones del frontend, llamar a los Stored Procedures correspondientes en la base de datos y devolver los resultados en formato JSON. También se encarga de la autenticación y la seguridad.
    
3. **Frontend (React & Vite):** La interfaz de usuario que corre en el navegador del cliente. Es una **Single-Page Application (SPA)** construida con React, que consume los datos de la API del backend para mostrar la información y proporcionar interactividad.
    

**Diagrama de Flujo Básico:**

![[Pasted image 20250723100804.png]]

### 2. El Backend (API - Node.js)

El backend es el cerebro de la aplicación, manejando la lógica de negocio a través de los SPs.

- **Tecnologías Principales:**
    
    - **Node.js:** Entorno de ejecución de JavaScript del lado del servidor.
        
    - **Express.js:** Framework para construir la API y gestionar las rutas.
        
    - **Knex.js:** Constructor de consultas SQL que usamos para conectarnos a SQL Server y ejecutar los Stored Procedures de forma segura.
        
    - **jsonwebtoken (JWT):** Para la gestión de la autenticación mediante tokens.
        
    - **bcrypt:** Para el hasheo seguro de contraseñas.
        
    - **cors:** Para gestionar los permisos de acceso a la API desde el frontend.
        
    - **dotenv:** Para gestionar las variables de entorno.
        
- **Estructura de Carpetas:**
    
    - controllers/: Contiene la lógica de cada endpoint. Un controlador recibe la petición, llama a los SPs que necesita y formula la respuesta. (Ej: userController.js, paradasController.js).
        
    - routes/: Define las URLs de la API. Cada archivo de ruta asocia una URL (ej: /api/users/change-password) con una función de un controlador.
        
    - config/: Contiene la configuración de la conexión a la base de datos (database.js).
        
    - verifyToken.js (middleware): Un archivo crucial que intercepta las peticiones a rutas protegidas. Verifica que el token JWT enviado por el frontend sea válido antes de permitir el acceso al controlador.
        
    - server.js: El punto de entrada de la aplicación. Configura el servidor, los middlewares y conecta las rutas.
        
- **Configuración (.env):**  
    El backend se configura mediante un archivo .env en su raíz. Este archivo es **crítico** y debe contener:
    
```
DB_HOST=192.168.130.6
DB_USER=calipso
DB_PASSWORD="1"
DB_NAME=RegistracionNET
DB_PORT=1433
JWT_SECRET="fsjfkljfsl#jfhfsjkjhsururyyhjchksrMorrrssddf1234"
PORT=3001
#Local
#HOST_ORIGIN=http://localhost:5173
#Produccion
HOST_ORIGIN=http://192.168.10.69
```

### 3. El Frontend (Aplicación - React)

El frontend es la parte visual e interactiva de la aplicación.

- **Tecnologías Principales:**
    
    - **React:** Librería para construir interfaces de usuario.
        
    - **Vite:** Herramienta de desarrollo y construcción extremadamente rápida.
        
    - **React Router:** Para gestionar la navegación y las URLs dentro de la aplicación.
        
    - **Axios:** Para realizar las peticiones HTTP a la API del backend.
        
    - **SweetAlert2:** Para mostrar popups y notificaciones al usuario.
        
    - **React-Data-Table-Component:** Para crear las tablas de datos con paginación, ordenamiento y filtrado.
        
    - **AdminLTE 3:** Plantilla de estilos y componentes base para la interfaz.
        
- **Estructura de Carpetas:**
    
    - public/: Contiene los archivos estáticos de la plantilla AdminLTE (dist/, plugins/) y el archivo .htaccess necesario para el despliegue en Apache.
        
    - src/components/: Contiene componentes reutilizables (Navbar, Sidebar, Footer, Login, etc.).
        
    - src/pages/: Contiene los componentes que representan una página completa (Abastecimiento, Paradas, Listado de Usuarios, etc.).
        
    - src/context/: Contiene los "Contextos" de React, que son el sistema de gestión de estado global de la aplicación (AuthContext, ThemeContext, LayoutContext).
        
    - src/hooks/: Contiene hooks personalizados. useAuth.jsx es crucial para acceder al contexto de autenticación desde cualquier componente.
        
    - src/utils/: Contiene utilidades, como ProtectedRoute.jsx, que es el componente "guardián" de las rutas protegidas.
        
    - src/layouts/: Contiene los esqueletos de página (MainLayout para la app principal, PublicLayout para el login).
        
    - src/main.jsx: El punto de entrada de la aplicación React. Configura los proveedores de contexto y el enrutador principal.
        
- **Flujo de Autenticación y Seguridad:**
    
    1. El usuario introduce sus credenciales en la página de **Login**.
        
    2. Se hace un POST a la API /api/auth/login.
        
    3. Si es exitoso, el backend devuelve un **token JWT** y los datos del usuario, incluyendo el flag cambioPassword.
        
    4. El AuthContext guarda el token y los datos del usuario en localStorage y en el estado de React.
        
    5. El usuario es redirigido a la aplicación.
        
    6. El componente ProtectedRoute se activa. Lee el estado del AuthContext:
        
        - Si no hay token, redirige a /login.
            
        - Si hay token pero user.cambioPassword es 1, redirige a la página /change-password.
            
        - Si todo está en orden, muestra el MainLayout con la página solicitada.
            
    7. Para cada petición posterior a la API, axios adjunta automáticamente el token en las cabeceras. El middleware verifyToken del backend lo valida en cada llamada.
        

---

### 4. Flujo de Desarrollo y Despliegue

#### **Para Trabajar en Local:**

1. **Backend:**
    
    - Navegar a la carpeta de la API.
        
    - Crear un archivo .env con las credenciales de la base de datos de desarrollo.
        
    - Ejecutar npm install una vez.
        
    - Ejecutar npm run dev para iniciar el servidor.
        
2. **Frontend:**
    
    - Navegar a la carpeta del frontend.
        
    - Crear un archivo .env.development con VITE_PUBLIC_BASE_PATH=/.
        
    - Ejecutar npm install una vez.
        
    - Ejecutar npm run dev para iniciar el servidor de desarrollo (ej. en http://localhost:5173).
        

#### **Para Desplegar en el Servidor Apache:**

1. **Configurar Entorno de Producción:**
    
    - En la carpeta del frontend, crea o verifica el archivo .env.production con el contenido: VITE_PUBLIC_BASE_PATH=/sintecrom-app-front/.
        
2. **Construir la Aplicación:**
    
    - En la carpeta del frontend, ejecuta el comando: npm run build.
        
    - Esto generará una carpeta dist con todos los archivos optimizados para producción.
        
3. **Subir los Archivos:**
    
    - Con un cliente FTP/SCP como WinSCP, sube el **contenido completo** de la carpeta dist a la carpeta de tu servidor web (ej: /var/www/html/sintecrom-app-front/).
        
    - Asegúrate de que el archivo .htaccess que está dentro de dist (proveniente de public) se haya subido correctamente.
        
4. **Configuración del Servidor (Realizar una única vez):**
    
    - Asegurarse de que mod_rewrite de Apache esté habilitado.
        
    - Asegurarse de que la configuración de Apache para el directorio permita AllowOverride All para que lea el archivo .htaccess.
        
    - Ajustar los permisos de los archivos en el servidor para que el usuario de Apache (www-data) pueda leerlos, y tu usuario (pmorrone) pueda escribir en ellos.