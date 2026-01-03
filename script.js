import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js";
import { getFirestore, collection, doc, getDocs, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBfchCQdkV9a6UW1COpuAf3gLHM29JjrZM",
    authDomain: "web-lavados-2cec4.firebaseapp.com",
    projectId: "web-lavados-2cec4",
    storageBucket: "web-lavados-2cec4.firebasestorage.app",
    messagingSenderId: "162943207842",
    appId: "1:162943207842:web:98d5b09057ca5690c90afb",
    measurementId: "G-H4X050S0F7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const OPCIONES = ["Juan", "Delfina", "Felicitas"];
const MAX_OCURRENCIAS = 5;
const TOTAL_LUGARES = 15;
let maxRondas = 5;

const container = document.getElementById("lavados-container");
const estadisticasBtn = document.getElementById("estadisticas-btn");
const selectorRonda = document.getElementById("selector-ronda");
const loader = document.getElementById("loader"); // Referencia al loader
let rondaActual = 1;
let datosGuardados = {};
let mostrandoEstadisticas = false;

// --- FUNCIONES DE UTILIDAD UI ---
const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer)
        toast.addEventListener('mouseleave', Swal.resumeTimer)
    }
});

function toggleLoader(show) {
    if(show) loader.classList.remove('hidden');
    else loader.classList.add('hidden');
}

function obtenerClaseNombre(nombre) {
    const clases = { "Juan": "nombre-juan", "Delfina": "nombre-delfina", "Felicitas": "nombre-felicitas" };
    return clases[nombre] || "";
}

function obtenerClaveFirebase(ronda, posicion) { return `ronda${ronda}_lugar${posicion}`; }
function obtenerClaveDatos(ronda, posicion) { return `ronda${ronda}_lugar${posicion}`; }

function verificarRondaCompleta(ronda) {
    for (let i = 0; i < TOTAL_LUGARES; i++) {
        if (!datosGuardados[obtenerClaveDatos(ronda, i)]) return false;
    }
    return true;
}

function obtenerRondasDisponibles() {
    const rondas = [];
    for (let i = 1; i <= maxRondas; i++) rondas.push(i);
    return rondas;
}

function actualizarSelectorRonda() {
    const rondaSeleccionada = selectorRonda.value;
    selectorRonda.innerHTML = '';
    const rondasDisponibles = obtenerRondasDisponibles();
    const rondasActivas = rondasDisponibles.filter(ronda => !verificarRondaCompleta(ronda));
    
    if (rondasActivas.length === 0) rondasActivas.push(maxRondas);
    
    rondasActivas.forEach(ronda => {
        const option = document.createElement('option');
        option.value = ronda;
        option.textContent = `Ronda ${ronda}`;
        selectorRonda.appendChild(option);
    });
    
    if (rondaSeleccionada && rondasActivas.includes(parseInt(rondaSeleccionada))) {
        selectorRonda.value = rondaSeleccionada;
    } else {
        rondaActual = rondasActivas[0];
        selectorRonda.value = rondasActivas[0];
    }
}

function verificarYAgregarNuevaRonda() {
    if (verificarRondaCompleta(rondaActual)) {
        const siguienteRonda = maxRondas + 1;
        maxRondas = siguienteRonda;
        actualizarSelectorRonda();
        rondaActual = siguienteRonda;
        selectorRonda.value = siguienteRonda;
        
        Swal.fire({
            title: '¡Ronda Completada!',
            text: `Se ha creado automáticamente la Ronda ${rondaActual}`,
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
        });
        return true;
    }
    return false;
}

function encontrarProximoLugarLibre(ronda) {
    for (let i = 0; i < TOTAL_LUGARES; i++) {
        const clave = obtenerClaveDatos(ronda, i);
        if (!datosGuardados[clave] || !datosGuardados[clave].nombre) return i;
    }
    return -1;
}

// --- LÓGICA DE AGREGAR RÁPIDO ---
async function agregarLavadoRapido(nombre) {
    toggleLoader(true);
    const fechaHoy = new Date().toISOString().split('T')[0];
    const horaActual = new Date().getHours();
    const turno = horaActual < 17 ? "mediodia" : "noche";
    
    const snapshot = await getDocs(collection(db, "lavados"));
    const conteoRondaActual = {};
    snapshot.forEach(docSnap => {
        const dato = docSnap.data();
        if (dato.nombre && dato.ronda === rondaActual) {
            conteoRondaActual[dato.nombre] = (conteoRondaActual[dato.nombre] || 0) + 1;
        }
    });

    let lugarLibre = encontrarProximoLugarLibre(rondaActual);
    let rondaParaUsar = rondaActual;
    let mensajeExtra = "";

    if (conteoRondaActual[nombre] >= MAX_OCURRENCIAS) {
        rondaParaUsar = rondaActual + 1;
        lugarLibre = encontrarProximoLugarLibre(rondaParaUsar);
        mensajeExtra = " (Límite alcanzado en ronda actual)";
        if (rondaParaUsar > maxRondas) { maxRondas = rondaParaUsar; actualizarSelectorRonda(); }
    } else if (lugarLibre === -1) {
        rondaParaUsar = rondaActual + 1;
        lugarLibre = encontrarProximoLugarLibre(rondaParaUsar);
        mensajeExtra = " (Ronda actual llena)";
        if (rondaParaUsar > maxRondas) { maxRondas = rondaParaUsar; actualizarSelectorRonda(); }
    }
    
    if (lugarLibre === -1) {
        toggleLoader(false);
        Swal.fire('Error', 'No hay lugares libres en las próximas rondas', 'error');
        return;
    }
    
    await setDoc(doc(db, "lavados", obtenerClaveFirebase(rondaParaUsar, lugarLibre)), {
        ronda: rondaParaUsar, posicion: lugarLibre, nombre: nombre, fecha: fechaHoy, turno: turno
    });
    
    if (rondaParaUsar !== rondaActual) {
        rondaActual = rondaParaUsar;
        selectorRonda.value = rondaParaUsar;
    }

    toggleLoader(false);
    Toast.fire({
        icon: 'success',
        title: `${nombre} agregado${mensajeExtra}`
    });
    
    // No hace falta llamar a cargarDatos, el onSnapshot lo hará
}

async function reiniciarRonda(ronda) {
    const result = await Swal.fire({
        title: `¿Reiniciar Ronda ${ronda}?`,
        text: "Se borrarán todos los datos de esta ronda. No se puede deshacer.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, borrar todo',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        toggleLoader(true);
        try {
            for (let i = 0; i < TOTAL_LUGARES; i++) {
                const claveFirebase = obtenerClaveFirebase(ronda, i);
                const clave = obtenerClaveDatos(ronda, i);
                await setDoc(doc(db, "lavados", claveFirebase), {
                    ronda: ronda, posicion: i, nombre: "", fecha: "", turno: ""
                });
                delete datosGuardados[clave];
            }
            toggleLoader(false);
            Swal.fire('¡Reiniciado!', `La Ronda ${ronda} está limpia.`, 'success');
        } catch (error) {
            toggleLoader(false);
            Swal.fire('Error', 'Hubo un problema al reiniciar.', 'error');
        }
    }
}

function calcularEstadisticas() {
    const estadisticas = {};
    for (let ronda = 1; ronda <= maxRondas; ronda++) {
        estadisticas[ronda] = { "Juan": 0, "Delfina": 0, "Felicitas": 0 };
    }
    Object.keys(datosGuardados).forEach(clave => {
        const data = datosGuardados[clave];
        if (data && data.nombre && data.ronda) {
            if (!estadisticas[data.ronda]) estadisticas[data.ronda] = { "Juan": 0, "Delfina": 0, "Felicitas": 0 };
            estadisticas[data.ronda][data.nombre]++;
        }
    });
    return estadisticas;
}

function renderEstadisticas() {
    container.innerHTML = "";
    container.className = "estadisticas-container";
    const estadisticas = calcularEstadisticas();
    
    for (let ronda = 1; ronda <= maxRondas; ronda++) {
        const rondaDiv = document.createElement("div");
        const esCompleta = verificarRondaCompleta(ronda);
        rondaDiv.className = esCompleta ? "estadisticas-ronda ronda-finalizada" : "estadisticas-ronda";
        let html = `<h3>Ronda ${ronda}${esCompleta ? ' - FINALIZADA' : ''}</h3>`;
        OPCIONES.forEach(nombre => {
            const cantidad = estadisticas[ronda] ? estadisticas[ronda][nombre] : 0;
            html += `<div class="estadistica-persona estadistica-${nombre.toLowerCase()}"><span>${nombre}</span><span>${cantidad} lavado${cantidad !== 1 ? 's' : ''}</span></div>`;
        });
        rondaDiv.innerHTML = html;
        container.appendChild(rondaDiv);
    }
}

// --- EDICIÓN MODERNA CON SWEETALERT ---
async function editarLavado(posicion) {
    const clave = obtenerClaveDatos(rondaActual, posicion);
    const data = datosGuardados[clave];
    if (!data || !data.nombre) return;

    // Crear HTML del formulario para el popup
    const formHtml = `
        <select id="swal-nombre" class="swal2-input">
            ${OPCIONES.map(n => `<option value="${n}" ${n === data.nombre ? 'selected' : ''}>${n}</option>`).join('')}
        </select>
        <input type="date" id="swal-fecha" class="swal2-input" value="${data.fecha}">
        <select id="swal-turno" class="swal2-input">
            <option value="mediodia" ${data.turno === 'mediodia' ? 'selected' : ''}>Mediodía</option>
            <option value="noche" ${data.turno === 'noche' ? 'selected' : ''}>Noche</option>
        </select>
    `;

    const { value: formValues } = await Swal.fire({
        title: 'Editar Lavado',
        html: formHtml,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar Cambios',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            return {
                nombre: document.getElementById('swal-nombre').value,
                fecha: document.getElementById('swal-fecha').value,
                turno: document.getElementById('swal-turno').value
            }
        }
    });

    if (formValues) {
        toggleLoader(true);
        // Validar límite (excluyendo el actual si no cambia el nombre)
        if (formValues.nombre !== data.nombre) {
            const snapshot = await getDocs(collection(db, "lavados"));
            const conteo = {};
            snapshot.forEach(docSnap => {
                const d = docSnap.data();
                if(d.nombre && d.ronda === rondaActual) conteo[d.nombre] = (conteo[d.nombre] || 0) + 1;
            });
            if ((conteo[formValues.nombre] || 0) >= MAX_OCURRENCIAS) {
                toggleLoader(false);
                Swal.fire('Límite alcanzado', `Ya se usó "${formValues.nombre}" 5 veces en esta ronda.`, 'warning');
                return;
            }
        }

        await setDoc(doc(db, "lavados", obtenerClaveFirebase(rondaActual, posicion)), {
            ronda: rondaActual, posicion: posicion, 
            nombre: formValues.nombre, fecha: formValues.fecha, turno: formValues.turno
        });
        toggleLoader(false);
        Toast.fire({ icon: 'success', title: 'Lavado actualizado' });
    }
}

async function borrarLavado(posicion) {
    const clave = obtenerClaveDatos(rondaActual, posicion);
    const data = datosGuardados[clave];
    
    const result = await Swal.fire({
        title: '¿Borrar este lavado?',
        text: `${data.nombre} - ${data.fecha}`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Sí, borrar'
    });

    if (result.isConfirmed) {
        toggleLoader(true);
        await setDoc(doc(db, "lavados", obtenerClaveFirebase(rondaActual, posicion)), {
            ronda: rondaActual, posicion: posicion, nombre: "", fecha: "", turno: ""
        });
        toggleLoader(false);
        Toast.fire({ icon: 'success', title: 'Lavado borrado' });
    }
}

function renderTodosLosLavados() {
    container.innerHTML = "";
    container.className = "vista-todas"; 
    
    for (let i = 0; i < TOTAL_LUGARES; i++) {
        const clave = obtenerClaveDatos(rondaActual, i);
        const data = datosGuardados[clave] || {};
        const div = document.createElement("div");
        
        if (data.nombre) {
            const claseColor = obtenerClaseNombre(data.nombre);
            div.className = `select-box collapsed ${claseColor}`;
            div.innerHTML = `
                <label>Ronda ${rondaActual} - Lugar ${i + 1} <span class="expand-indicator">▼</span></label>
                <div class="estado-resumen">${data.nombre}</div>
                <div class="info-completa">
                    <p><strong>${data.nombre}</strong></p>
                    <p>${data.fecha}</p>
                    <p>${data.turno}</p>
                    <div class="botones-accion">
                        <button class="editar-btn" data-pos="${i}">Editar</button>
                        <button class="borrar-btn" data-pos="${i}">Borrar</button>
                    </div>
                </div>`;
        } else {
            div.className = "select-box collapsed";
            div.innerHTML = `
                <label>Ronda ${rondaActual} - Lugar ${i + 1} <span class="expand-indicator">▼</span></label>
                <div class="estado-resumen">LIBRE</div>
                <div class="formulario-contenido">
                    <select class="nombre-select" data-pos="${i}">
                        <option value="">Elegir nombre...</option>
                        ${OPCIONES.map(o => `<option value="${o}">${o}</option>`).join("")}
                    </select>
                    <div class="fecha-container">
                        <input type="date" class="fecha-input" data-pos="${i}" />
                        <button type="button" class="hoy-btn" onclick="setHoy(this)">Hoy</button>
                    </div>
                    <select class="turno-select" data-pos="${i}">
                        <option value="">Turno...</option>
                        <option value="mediodia">Mediodía</option>
                        <option value="noche">Noche</option>
                    </select>
                    <button class="guardar-btn" data-pos="${i}">Guardar</button>
                </div>`;
        }
        
        div.addEventListener('click', function(e) {
            if (['SELECT', 'INPUT', 'BUTTON'].includes(e.target.tagName)) return;
            this.classList.toggle('collapsed');
        });
        container.appendChild(div);
    }
}

container.addEventListener("click", async function(e) {
    if (e.target.classList.contains("guardar-btn")) {
        const div = e.target.closest(".select-box");
        const nombre = div.querySelector(".nombre-select").value;
        const fecha = div.querySelector(".fecha-input").value;
        const turno = div.querySelector(".turno-select").value;
        const posicion = parseInt(e.target.getAttribute("data-pos"));

        if (!nombre || !fecha || !turno) {
            return Swal.fire('Faltan datos', 'Por favor completá todos los campos.', 'info');
        }
        
        toggleLoader(true);
        // Validar conteo
        const snapshot = await getDocs(collection(db, "lavados"));
        const conteo = {};
        snapshot.forEach(docSnap => {
            const d = docSnap.data();
            if(d.ronda === rondaActual) conteo[d.nombre] = (conteo[d.nombre] || 0) + 1;
        });

        if (conteo[nombre] >= MAX_OCURRENCIAS) {
            toggleLoader(false);
            return Swal.fire('Límite alcanzado', `Ya se usó "${nombre}" 5 veces.`, 'warning');
        }

        await setDoc(doc(db, "lavados", obtenerClaveFirebase(rondaActual, posicion)), {
            ronda: rondaActual, posicion, nombre, fecha, turno
        });
        toggleLoader(false);
        verificarYAgregarNuevaRonda();
    }
    
    if (e.target.classList.contains("editar-btn")) await editarLavado(parseInt(e.target.getAttribute("data-pos")));
    if (e.target.classList.contains("borrar-btn")) await borrarLavado(parseInt(e.target.getAttribute("data-pos")));
});

document.getElementById("btn-juan").addEventListener("click", () => agregarLavadoRapido("Juan"));
document.getElementById("btn-delfina").addEventListener("click", () => agregarLavadoRapido("Delfina"));
document.getElementById("btn-felicitas").addEventListener("click", () => agregarLavadoRapido("Felicitas"));

estadisticasBtn.addEventListener("click", function() {
    mostrandoEstadisticas = !mostrandoEstadisticas;
    estadisticasBtn.textContent = mostrandoEstadisticas ? "Volver" : "Ver Estadísticas";
    mostrandoEstadisticas ? renderEstadisticas() : renderTodosLosLavados();
});

selectorRonda.addEventListener("change", function() {
    rondaActual = parseInt(this.value);
    mostrandoEstadisticas ? renderEstadisticas() : renderTodosLosLavados();
});

document.getElementById("reiniciar-ronda-btn").addEventListener("click", () => reiniciarRonda(rondaActual));

// LISTENER EN TIEMPO REAL
onSnapshot(collection(db, "lavados"), (snapshot) => {
    datosGuardados = {};
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const clave = obtenerClaveDatos(data.ronda || 1, data.posicion);
        datosGuardados[clave] = data;
        if (data.ronda && data.ronda > maxRondas) maxRondas = data.ronda;
    });
    
    actualizarSelectorRonda();
    if(mostrandoEstadisticas) renderEstadisticas();
    else renderTodosLosLavados();
    toggleLoader(false); // Ocultar loader al terminar carga inicial
});

window.setHoy = function(boton) {
    const fechaInput = boton.parentElement.querySelector('.fecha-input');
    fechaInput.value = new Date().toISOString().split('T')[0];
}

// Inicialización
toggleLoader(true);