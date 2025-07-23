use RegistracionNET
GO

-- =============================================
-- CREAR TABLA ROLES
-- =============================================
CREATE TABLE dbo.Roles (
    idRol INT IDENTITY(1,1) NOT NULL,
    nombre VARCHAR(50) NOT NULL,
    CONSTRAINT PK_Roles PRIMARY KEY (idRol)
);
GO

PRINT 'Tabla [Roles] creada exitosamente.';
GO

-- =============================================
-- CREAR TABLA PERMISOS
-- =============================================
CREATE TABLE dbo.Permisos (
    idPermiso INT IDENTITY(1,1) NOT NULL,
    nombre VARCHAR(50) NOT NULL,
    clave VARCHAR(50) NOT NULL,
    CONSTRAINT PK_Permisos PRIMARY KEY (idPermiso),
    CONSTRAINT UQ_Permisos_clave UNIQUE (clave) -- La 'clave' debe ser única
);
GO

PRINT 'Tabla [Permisos] creada exitosamente.';
GO


-- =============================================
-- CREAR TABLA USUARIOS
-- =============================================
CREATE TABLE dbo.UsuariosDB (
    idUsuario INT IDENTITY(1,1) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) NULL, -- Permite valores NULL
    password VARCHAR(255) NOT NULL,
    idRol INT NOT NULL,
    CONSTRAINT PK_UsuariosDB PRIMARY KEY (idUsuario),
    CONSTRAINT UQ_UsuariosDB_nombre UNIQUE (nombre), -- El 'nombre' de usuario debe ser único
    CONSTRAINT FK_UsuariosDB_Roles FOREIGN KEY (idRol) REFERENCES dbo.Roles(idRol)
);
GO

-- Crear el índice único filtrado para el email que permite múltiples NULLs
CREATE UNIQUE NONCLUSTERED INDEX UQ_UsuariosDB_email_filtered
ON dbo.UsuariosDB(email)
WHERE email IS NOT NULL;
GO

PRINT 'Tabla [UsuariosDB] y sus índices creados exitosamente.';
GO


-- =============================================
-- CREAR TABLA ROL-PERMISO
-- =============================================
CREATE TABLE dbo.RolPermiso (
    idRol INT NOT NULL,
    idPermiso INT NOT NULL,
    CONSTRAINT PK_RolPermiso PRIMARY KEY (idRol, idPermiso), -- Clave primaria compuesta
    CONSTRAINT FK_RolPermiso_Roles FOREIGN KEY (idRol) REFERENCES dbo.Roles(idRol) ON DELETE CASCADE, -- Si se borra un rol, se borra la asignación
    CONSTRAINT FK_RolPermiso_Permisos FOREIGN KEY (idPermiso) REFERENCES dbo.Permisos(idPermiso) ON DELETE CASCADE -- Si se borra un permiso, se borra la asignación
);
GO

PRINT 'Tabla [RolPermiso] creada exitosamente.';
GO



-- =============================================
-- INSERTAR DATOS INICIALES
-- =============================================

-- Insertar Roles
INSERT INTO dbo.Roles (nombre) VALUES
('Administrador'),
('Basico'),
('Calidad'),
('Operario'),
('Supervisor');
GO

-- Insertar Permisos
INSERT INTO dbo.Permisos (nombre, clave) VALUES
('Ver Calidad', 'ver_calidad'),
('Ver Otros Modulos', 'ver_otros'),
('Ver Usuarios', 'ver_usuarios'),
('Ver Permisos', 'ver_permisos'),
('Ver Roles', 'ver_roles');
GO

-- Asignar Permisos al Rol de Administrador (idRol = 1)
-- Le damos todos los permisos
INSERT INTO dbo.RolPermiso (idRol, idPermiso) VALUES
(1, 1), -- ver_calidad
(1, 2), -- ver_otros
(1, 3), -- ver_usuarios
(1, 4), -- ver_permisos
(1, 5); -- ver_roles
GO

-- Asignar Permisos al Rol Básico (idRol = 2)
-- Le damos solo el permiso 'ver_otros'
INSERT INTO dbo.RolPermiso (idRol, idPermiso) VALUES
(2, 2); -- ver_otros
GO

-- Crear un usuario Administrador para poder iniciar sesión
-- Reemplaza 'tu_password_seguro' por una contraseña real. 
-- El backend la hasheará en el registro, pero para el primer usuario lo hacemos aquí.
-- La contraseña '12345678' hasheada es: $2b$10$T/daxC2upn.iotE.TTMe.uD0H8xSgH/w/O2lO.i3ew6.JsmO.oR.G
INSERT INTO dbo.UsuariosDB (nombre, email, password, idRol) VALUES
('pmorrone', 'morronepablo@gmail.com', '$2b$10$rFKbpq1/jlHD66LGggV1PelA9ypufsHGecsmmxgx9BXeQLt/xlMjG', 1);
GO

PRINT 'Datos iniciales insertados. ¡La base de datos está restaurada!';
GO

-- Añadir la nueva columna a la tabla UsuariosDB
ALTER TABLE UsuariosDB
ADD cambioPassword BIT NOT NULL DEFAULT 1;

GO

-- BIT es el tipo de dato booleano en SQL Server (0 para false, 1 para true)
-- NOT NULL para asegurar que siempre tenga un valor.
-- DEFAULT 1 para que todos los usuarios nuevos que se creen
-- tengan por defecto la obligación de cambiar la contraseña.

-- Opcional: Si quieres que los usuarios existentes NO tengan que cambiarla,
-- ejecuta esto DESPUÉS de añadir la columna.
-- UPDATE UsuariosDB SET cambioPassword = 0;

--TRUNCATE TABLE dbo.UsuariosDB;
--GO