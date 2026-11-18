const express = require('express');
const cors = require('cors');
const pool = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Prueba de conexión
app.get('/api/test', async (req, res) => {
    try {
        const resultado = await pool.query('SELECT NOW() AS hora_neon');
        res.json({ mensaje: "Conexión perfecta con Neon 🐘", hora: resultado.rows[0].hora_neon });
    } catch (error) {
        console.error("🚨 ERROR REAL DE NEON:", error);
        res.status(500).json({ error: "Fallo la conexión" });
    }
});

// === NUEVA RUTA DE REGISTRO ===
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
// ==============================
//RUTA LOGIN========
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor escuchando en puerto ${PORT}`);
});