const express = require('express');
const cors = require('cors');
const pool = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

//== PRUEBA DE CONEXIÓN ==
app.get('/api/test', async (req, res) => {
    try {
        const resultado = await pool.query('SELECT NOW() AS hora_neon');
        res.json({ mensaje: "Conexión perfecta con Neon 🐘", hora: resultado.rows[0].hora_neon });
    } catch (error) {
        console.error("🚨 ERROR REAL DE NEON:", error);
        res.status(500).json({ error: "Fallo la conexión" });
    }
});

// === RUTA DE REGISTRO ===
app.post('/api/registro', async (req, res) => {
    const { dni, nombre, apellidos, telefono, email, password, rol } = req.body;

    try {
        const nuevaCuenta = await pool.query(
            'INSERT INTO users (dni, nombre, apellidos, telefono, email, hash_password, rol) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, nombre, apellidos, email, rol',
            [dni, nombre, apellidos, telefono, email, password, rol]
        );

        res.status(201).json({
            mensaje: 'Usuario registrado con éxito',
            usuario: nuevaCuenta.rows[0]
        });
    } catch (error) {
        console.error("🚨 ERROR AL REGISTRAR:", error);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'El DNI o el correo ya están registrados' });
        }
        res.status(500).json({ error: 'Error al guardar en la base de datos' });
    }
});

//== RUTA LOGIN ==
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const resultado = await pool.query(
            'SELECT id, nombre, apellidos, email, rol, hash_password FROM users WHERE email = $1',
            [email]
        );

        if (resultado.rows.length === 0) {
            return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
        }

        const usuario = resultado.rows[0];

        if (usuario.hash_password !== password) {
            return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
        }

        delete usuario.hash_password;

        res.json({
            mensaje: 'Inicio de sesión correcto',
            usuario
        });
    } catch (error) {
        console.error("🚨 ERROR AL INICIAR SESIÓN:", error);
        res.status(500).json({ error: 'Error en el servidor al iniciar sesión' });
    }
});

// == RUTA OBTENER MASCOTAS DE UN USUARIO ==
app.get('/api/mascotas', async (req, res) => {
    const { usuario_id } = req.query;

    if (!usuario_id) {
        return res.status(400).json({ error: 'Falta el usuario_id' });
    }

    try {
        const resultado = await pool.query(
            'SELECT * FROM mascotas WHERE usuario_id = $1 ORDER BY id DESC',
            [usuario_id]
        );
        res.json({ mascotas: resultado.rows });
    } catch (error) {
        console.error("🚨 ERROR AL OBTENER MASCOTAS:", error);
        res.status(500).json({ error: 'Error al cargar las mascotas' });
    }
});

// == OBTENER UNA MASCOTA POR ID (PARA PERFIL DETALLADO / HISTORIAL) ==
app.get('/api/mascotas/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const resultado = await pool.query(
            'SELECT * FROM mascotas WHERE id = $1',
            [id]
        );
        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Mascota no encontrada' });
        }
        res.json({ mascota: resultado.rows[0] });
    } catch (error) {
        console.error("🚨 ERROR AL OBTENER MASCOTA:", error);
        res.status(500).json({ error: 'Error al cargar la mascota' });
    }
});

// == ACTUALIZAR DATOS DE LA CUENTA DEL DUEÑO ==
app.put('/api/usuarios/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, apellidos, telefono, email } = req.body;

    try {
        const actualizado = await pool.query(
            `UPDATE users
             SET nombre = $1, apellidos = $2, telefono = $3, email = $4
             WHERE id = $5
             RETURNING id, nombre, apellidos, telefono, email, rol`,
            [nombre, apellidos, telefono, email, id]
        );

        if (actualizado.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({
            mensaje: 'Datos actualizados correctamente',
            usuario: actualizado.rows[0]
        });
    } catch (error) {
        console.error("🚨 ERROR AL ACTUALIZAR USUARIO:", error);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Ese correo ya está en uso por otra cuenta' });
        }
        res.status(500).json({ error: 'Error al actualizar el perfil' });
    }
});

const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin1234';

function verificarAdmin(req, res, next) {
    const clave = req.headers['x-admin-password'];
    if (!clave || clave !== ADMIN_PASS) {
        return res.status(401).json({ error: 'Contraseña de administrador incorrecta' });
    }
    next();
}

// == OBTENER USUARIOS Y MASCOTAS PARA EL PANEL ADMIN ==
app.get('/api/admin/resumen', verificarAdmin, async (req, res) => {
    try {
        const usuariosRes = await pool.query(
            'SELECT id, nombre, apellidos, email, telefono, rol FROM users ORDER BY id ASC'
        );
        const mascotasRes = await pool.query(
            `SELECT m.*, u.nombre AS dueno_nombre, u.email AS dueno_email
             FROM mascotas m
             LEFT JOIN users u ON m.usuario_id = u.id
             ORDER BY m.id DESC`
        );

        res.json({
            usuarios: usuariosRes.rows,
            mascotas: mascotasRes.rows
        });
    } catch (error) {
        console.error("🚨 ERROR EN ADMIN RESUMEN:", error);
        res.status(500).json({ error: 'Error al cargar los datos de administración' });
    }
});

// == REASIGNAR MASCOTA A OTRO USUARIO ==
app.patch('/api/mascotas/:id/usuario', verificarAdmin, async (req, res) => {
    const { id } = req.params;
    const { usuario_id } = req.body;

    if (!usuario_id) {
        return res.status(400).json({ error: 'Falta el nuevo usuario_id' });
    }

    try {
        const actualizada = await pool.query(
            `UPDATE mascotas
             SET usuario_id = $1
             WHERE id = $2
             RETURNING *`,
            [usuario_id, id]
        );

        if (actualizada.rows.length === 0) {
            return res.status(404).json({ error: 'Mascota no encontrada' });
        }

        res.json({
            mensaje: 'Mascota reasignada correctamente',
            mascota: actualizada.rows[0]
        });
    } catch (error) {
        console.error("🚨 ERROR AL REASIGNAR MASCOTA:", error);
        if (error.code === '23503') {
            return res.status(400).json({ error: 'Ese usuario_id no existe en users' });
        }
        res.status(500).json({ error: 'Error al reasignar la mascota' });
    }
});

// == ELIMINAR MASCOTA POR ID ==
app.delete('/api/mascotas/:id', verificarAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        const borrada = await pool.query(
            'DELETE FROM mascotas WHERE id = $1 RETURNING id, nombre',
            [id]
        );

        if (borrada.rows.length === 0) {
            return res.status(404).json({ error: 'Mascota no encontrada' });
        }

        res.json({
            mensaje: 'Mascota eliminada correctamente',
            mascota: borrada.rows[0]
        });
    } catch (error) {
        console.error("🚨 ERROR AL ELIMINAR MASCOTA:", error);
        res.status(500).json({ error: 'Error al eliminar la mascota' });
    }
});





const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor escuchando en puerto ${PORT}`);
});
// == RUTA REGISTRO NUEVA MASCOTAS ==
app.post('/api/mascotas', async (req, res) => {
    const {
        nombre,
        especie,
        raza,
        genero,
        nif_chip,
        fecha_nacimiento,
        peso,
        datos_relevantes,
        user_id
    } = req.body;
    
    try {
        const nuevaMascota = await pool.query(
            `INSERT INTO mascotas
            (nombre, especie, raza, genero, nif_chip, fecha_nac, peso, datos_relevantes, usuario_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *`,
            [nombre, especie, raza, genero, nif_chip, fecha_nacimiento || null, peso, datos_relevantes, user_id]
        );

        res.status(201).json({
            mensaje: 'Mascota registrada con éxito',
            mascota: nuevaMascota.rows[0]
        });
    } catch (error) {
        console.error("🚨 ERROR AL REGISTRAR MASCOTA:", error);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Ese NIF/Chip ya está registrado' });
        }
        res.status(500).json({ error: 'Error al guardar la mascota en la base de datos' });
    }
});
//=== VERIFICACIÓN DE ADMIN ===
async function verificarAdmin(req, res, next) {
    const adminId = req.headers['x-admin-id'];
    if (!adminId) {
        return res.status(401).json({ error: 'Falta identificación de administrador' });
    }

    try {
        const result = await pool.query(
            'SELECT id, rol FROM users WHERE id = $1',
            [adminId]
        );
        const user = result.rows[0];

        if (!user || (user.rol || '').toUpperCase() !== 'ADMIN') {
            return res.status(403).json({ error: 'Acceso denegado: no tienes permisos de administrador' });
        }

        next();
    } catch (error) {
        console.error('Error verificando admin:', error);
        res.status(500).json({ error: 'Error interno al verificar permisos' });
    }
}