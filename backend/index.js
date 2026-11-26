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

// OBTENER UNA MASCOTA POR ID (PARA PERFIL DETALLADO / HISTORIAL)
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