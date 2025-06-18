USE node_api_db
GO

-- Procedimiento para obtener todos los usuarios
ALTER PROCEDURE GetAllUsers
AS
BEGIN
    SET NOCOUNT ON;
    SELECT id, name, email FROM users;
END;
GO

-- Procedimiento para crear un usuario
ALTER PROCEDURE CreateUser
    @Name NVARCHAR(100),
    @Email NVARCHAR(100),
    @Password NVARCHAR(255)
AS
BEGIN
    -- Evitar mensajes adicionales (opcional, lo quitamos para depurar)
    -- SET NOCOUNT ON;

    -- Insertar el usuario
    INSERT INTO users (name, email, password)
    VALUES (@Name, @Email, @Password);

    -- Devolver los datos del usuario recién creado (usamos @@IDENTITY como alternativa)
    SELECT id, name, email
    FROM users
    WHERE id = @@IDENTITY;
END;
GO

-- Procedimiento para actualizar un usuario
ALTER PROCEDURE UpdateUser
    @Id INT,
    @Name NVARCHAR(100),
    @Email NVARCHAR(100),
    @Password NVARCHAR(255) = NULL -- Hacer que @Password sea opcional
AS
BEGIN
    -- Actualizar los campos name y email siempre
    UPDATE users
    SET 
        name = @Name,
        email = @Email,
        password = CASE 
                     WHEN @Password IS NOT NULL THEN @Password 
                     ELSE password 
                   END
    WHERE id = @Id;

    -- Verificar si se actualizó alguna fila
    IF @@ROWCOUNT = 0
    BEGIN
        RETURN -1; -- Indica que no se encontró el usuario
    END

    -- Devolver los datos actualizados del usuario (sin contraseña)
    SELECT id, name, email
    FROM users
    WHERE id = @Id;

    RETURN 0; -- Éxito
END;
GO

-- Procedimiento para eliminar un usuario
CREATE PROCEDURE DeleteUser
    @Id INT
AS
BEGIN
    DELETE FROM users
    WHERE id = @Id;
    IF @@ROWCOUNT = 0
        RETURN -1; -- Indica que no se encontró el usuario
    RETURN 0; -- Éxito
END;
GO

USE node_api_db
GO


-- Procedimiento para obtener todos los clientes
ALTER PROCEDURE GetAllClients
AS
BEGIN
    SET NOCOUNT ON;
    SELECT id, name, phone, address, created_at
    FROM clients;
END;
GO

-- Procedimiento para crear un cliente
CREATE PROCEDURE CreateClient
    @Name NVARCHAR(100),
    @Phone NVARCHAR(100),
    @Address NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO clients (name, phone, address)
    VALUES (@Name, @Phone, @Address);
    
    -- Devolver los datos del cliente recién creado
    SELECT id, name, phone, address, created_at
    FROM clients
    WHERE id = SCOPE_IDENTITY();
END;
GO

-- Procedimiento para actualizar un cliente
CREATE PROCEDURE UpdateClient
    @Id INT,
    @Name NVARCHAR(100),
    @Phone NVARCHAR(100),
    @Address NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE clients
    SET 
        name = @Name,
        phone = @Phone,
        address = @Address,
        updated_at = GETDATE()
    WHERE id = @Id;
    
    IF @@ROWCOUNT = 0
    BEGIN
        RETURN -1; -- Indica que no se encontró el cliente
    END

    -- Devolver los datos actualizados
    SELECT id, name, phone, address, created_at
    FROM clients
    WHERE id = @Id;

    RETURN 0; -- Éxito
END;
GO

-- Procedimiento para eliminar un cliente
CREATE PROCEDURE DeleteClient
    @Id INT
AS
BEGIN
    DELETE FROM clients
    WHERE id = @Id;
    IF @@ROWCOUNT = 0
        RETURN -1; -- Indica que no se encontró el cliente
    RETURN 0; -- Éxito
END;
GO
