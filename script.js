import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js";
import { getFirestore, collection, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

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
const loader = document.getElementById("loader");
const lblBtnEstadisticas = document.getElementById("lbl-btn-estadisticas");

let rondaActual = 1;
let datosGuardados = {};
let mostrandoEstadisticas = false;

const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true
});

function toggleLoader(show) {
    if (loader) loader.classList.toggle('hidden', !show);
}

function obtenerClaveFirebase(ronda, posicion) { return `ronda${ronda}_lugar${posicion}`; }

function verificarRondaCompleta(ronda) {
    for (let i = 0; i < TOTAL_LUGARES; i++) {
        const item = datosGuardados[obtenerClaveFirebase(ronda, i)];
        if (!item || !item.nombre) return false;
    }
    return true;
}

function obtenerConteoRonda(ronda) {
    const conteo = { "Juan": 0, "Delfina": 0, "Felicitas": 0 };
    Object.values(datosGuardados).forEach(d => {
        if (d.ronda === ronda && d.nombre && conteo[d.nombre] !== undefined) {
            conteo[d.nombre]++;
        }
    });
    return conteo;
}

function encontrarProximoLugarLibre(ronda) {
    for (let i = 0; i < TOTAL_LUGARES; i++) {
        const clave = obtenerClaveFirebase(ronda, i);
        if (!datosGuardados[clave] || !datosGuardados[clave].nombre) return i;
    }
    return -1;
}

let cargaInicial = true;

function obtenerRondaActivaInicial() {
    // Busca la primera ronda que no esté completa
    for (let r = 1; r <= maxRondas; r++) {
        if (!verificarRondaCompleta(r)) return r;
    }
    // Si todas están completas, va a la última
    return maxRondas;
}

function actualizarSelectorRonda() {
    selectorRonda.innerHTML = '';
    for (let i = 1; i <= maxRondas; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Ronda ${i}${verificarRondaCompleta(i) ? ' (Completa)' : ''}`;
        selectorRonda.appendChild(option);
    }
    
    // Si es la primera carga, seleccionamos la ronda activa en curso
    if (cargaInicial) {
        rondaActual = obtenerRondaActivaInicial();
        cargaInicial = false;
    }
    
    selectorRonda.value = rondaActual;
}

// --- ACCIONES DE AGREGAR / EDITAR / BORRAR ---
async function agregarLavadoRapido(nombre) {
    toggleLoader(true);
    const fechaHoy = new Date().toISOString().split('T')[0];
    const horaActual = new Date().getHours();
    const turno = horaActual < 17 ? "mediodia" : "noche";

    const conteoRondaActual = obtenerConteoRonda(rondaActual);
    let lugarLibre = encontrarProximoLugarLibre(rondaActual);
    let rondaParaUsar = rondaActual;
    let mensajeExtra = "";

    if (conteoRondaActual[nombre] >= MAX_OCURRENCIAS) {
        rondaParaUsar = rondaActual + 1;
        lugarLibre = encontrarProximoLugarLibre(rondaParaUsar);
        mensajeExtra = " (Pasa a la siguiente ronda)";
        if (rondaParaUsar > maxRondas) { maxRondas = rondaParaUsar; actualizarSelectorRonda(); }
    } else if (lugarLibre === -1) {
        rondaParaUsar = rondaActual + 1;
        lugarLibre = encontrarProximoLugarLibre(rondaParaUsar);
        mensajeExtra = " (Ronda llena, pasa a la siguiente)";
        if (rondaParaUsar > maxRondas) { maxRondas = rondaParaUsar; actualizarSelectorRonda(); }
    }

    if (lugarLibre === -1) {
        toggleLoader(false);
        Swal.fire('Atención', 'No hay lugares disponibles en la ronda actual ni en la siguiente.', 'info');
        return;
    }

    try {
        await setDoc(doc(db, "lavados", obtenerClaveFirebase(rondaParaUsar, lugarLibre)), {
            ronda: rondaParaUsar, posicion: lugarLibre, nombre: nombre, fecha: fechaHoy, turno: turno
        });
        if (rondaParaUsar !== rondaActual) {
            rondaActual = rondaParaUsar;
            selectorRonda.value = rondaParaUsar;
        }
        Toast.fire({ icon: 'success', title: `${nombre} registrado${mensajeExtra}` });
    } catch (err) {
        Swal.fire('Error', 'No se pudo guardar el registro.', 'error');
    } finally {
        toggleLoader(false);
    }
}

async function abrirModalNuevoLavado(posicion) {
    const fechaHoy = new Date().toISOString().split('T')[0];
    const turnoDefault = new Date().getHours() < 17 ? "mediodia" : "noche";

    const { value: formValues } = await Swal.fire({
        title: `Lugar ${posicion + 1} - Ronda ${rondaActual}`,
        html: `
            <select id="swal-nombre" class="swal2-input">
                <option value="" disabled selected>Seleccionar persona...</option>
                ${OPCIONES.map(n => `<option value="${n}">${n}</option>`).join('')}
            </select>
            <input type="date" id="swal-fecha" class="swal2-input" value="${fechaHoy}">
            <select id="swal-turno" class="swal2-input">
                <option value="mediodia" ${turnoDefault === 'mediodia' ? 'selected' : ''}>☀️ Mediodía</option>
                <option value="noche" ${turnoDefault === 'noche' ? 'selected' : ''}>🌙 Noche</option>
            </select>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            const nombre = document.getElementById('swal-nombre').value;
            const fecha = document.getElementById('swal-fecha').value;
            const turno = document.getElementById('swal-turno').value;
            if (!nombre || !fecha || !turno) {
                Swal.showValidationMessage('Todos los campos son obligatorios');
                return false;
            }
            return { nombre, fecha, turno };
        }
    });

    if (formValues) {
        const conteo = obtenerConteoRonda(rondaActual);
        if ((conteo[formValues.nombre] || 0) >= MAX_OCURRENCIAS) {
            return Swal.fire('Límite alcanzado', `${formValues.nombre} ya tiene los 5 lavados en esta ronda.`, 'warning');
        }

        toggleLoader(true);
        await setDoc(doc(db, "lavados", obtenerClaveFirebase(rondaActual, posicion)), {
            ronda: rondaActual, posicion, ...formValues
        });
        toggleLoader(false);
        Toast.fire({ icon: 'success', title: 'Lavado asignado' });
    }
}

async function editarLavado(posicion) {
    const clave = obtenerClaveFirebase(rondaActual, posicion);
    const data = datosGuardados[clave];
    if (!data || !data.nombre) return;

    const { value: formValues } = await Swal.fire({
        title: 'Editar Registro',
        html: `
            <select id="swal-nombre" class="swal2-input">
                ${OPCIONES.map(n => `<option value="${n}" ${n === data.nombre ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
            <input type="date" id="swal-fecha" class="swal2-input" value="${data.fecha}">
            <select id="swal-turno" class="swal2-input">
                <option value="mediodia" ${data.turno === 'mediodia' ? 'selected' : ''}>☀️ Mediodía</option>
                <option value="noche" ${data.turno === 'noche' ? 'selected' : ''}>🌙 Noche</option>
            </select>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Actualizar',
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
        if (formValues.nombre !== data.nombre) {
            const conteo = obtenerConteoRonda(rondaActual);
            if ((conteo[formValues.nombre] || 0) >= MAX_OCURRENCIAS) {
                return Swal.fire('Límite alcanzado', `${formValues.nombre} ya tiene 5 lavados en esta ronda.`, 'warning');
            }
        }

        toggleLoader(true);
        await setDoc(doc(db, "lavados", clave), {
            ronda: rondaActual, posicion, ...formValues
        });
        toggleLoader(false);
        Toast.fire({ icon: 'success', title: 'Registro actualizado' });
    }
}

async function borrarLavado(posicion) {
    const clave = obtenerClaveFirebase(rondaActual, posicion);
    const data = datosGuardados[clave];

    const result = await Swal.fire({
        title: '¿Liberar este lugar?',
        text: `${data.nombre} (${data.fecha})`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff4b4b',
        confirmButtonText: 'Sí, borrar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        toggleLoader(true);
        await setDoc(doc(db, "lavados", clave), {
            ronda: rondaActual, posicion, nombre: "", fecha: "", turno: ""
        });
        toggleLoader(false);
        Toast.fire({ icon: 'success', title: 'Lugar liberado' });
    }
}

async function reiniciarRonda(ronda) {
    const result = await Swal.fire({
        title: `¿Reiniciar Ronda ${ronda}?`,
        text: "Se borrarán todos los lavados de esta ronda. Esta acción es irreversible.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff4b4b',
        confirmButtonText: 'Sí, reiniciar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        toggleLoader(true);
        try {
            const batchPromises = [];
            for (let i = 0; i < TOTAL_LUGARES; i++) {
                const clave = obtenerClaveFirebase(ronda, i);
                batchPromises.push(setDoc(doc(db, "lavados", clave), {
                    ronda: ronda, posicion: i, nombre: "", fecha: "", turno: ""
                }));
            }
            await Promise.all(batchPromises);
            Swal.fire('¡Listo!', `La Ronda ${ronda} ha sido reiniciada.`, 'success');
        } catch (error) {
            Swal.fire('Error', 'Hubo un problema al reiniciar la ronda.', 'error');
        } finally {
            toggleLoader(false);
        }
    }
}

// --- RENDERIZADO Y DASHBOARD ---
function renderTodosLosLavados() {
    container.innerHTML = "";
    container.className = "vista-todas";

    for (let i = 0; i < TOTAL_LUGARES; i++) {
        const clave = obtenerClaveFirebase(rondaActual, i);
        const data = datosGuardados[clave] || {};
        const div = document.createElement("div");

        if (data.nombre) {
            const personaClass = `is-${data.nombre.toLowerCase()}`;
            const turnoIcono = data.turno === 'mediodia' ? '☀️ Mediodía' : '🌙 Noche';
            div.className = `card-lavado ${personaClass}`;
            div.innerHTML = `
                <div class="card-header">
                    <span>#${i + 1}</span>
                    <span class="badge-turno">${turnoIcono}</span>
                </div>
                <div class="card-body">
                    <div class="card-nombre">${data.nombre}</div>
                    <div class="card-meta">
                        <i class="ph ph-calendar-blank"></i> ${data.fecha || 'Sin fecha'}
                    </div>
                </div>
                <div class="card-acciones">
                    <button class="btn-card-accion editar-btn" data-pos="${i}">Editar</button>
                    <button class="btn-card-accion borrar borrar-btn" data-pos="${i}">Borrar</button>
                </div>
            `;
        } else {
            div.className = "card-lavado is-empty";
            div.innerHTML = `
                <div class="empty-placeholder" data-pos="${i}">
                    <i class="ph ph-plus-circle"></i>
                    <span>Lugar #${i + 1}</span>
                </div>
            `;
            div.addEventListener('click', () => abrirModalNuevoLavado(i));
        }
        container.appendChild(div);
    }
    actualizarDashboard();
}

function renderEstadisticas() {
    container.innerHTML = "";
    container.className = "estadisticas-container";

    for (let r = 1; r <= maxRondas; r++) {
        const rondaDiv = document.createElement("div");
        const conteo = obtenerConteoRonda(r);
        const esCompleta = verificarRondaCompleta(r);

        rondaDiv.className = `estadisticas-ronda ${esCompleta ? 'ronda-finalizada' : ''}`;
        let html = `<h3>Ronda ${r} ${esCompleta ? '<span style="color:#00E676; font-size:0.8rem;">✓ Completa</span>' : ''}</h3>`;

        OPCIONES.forEach(nombre => {
            const cant = conteo[nombre] || 0;
            html += `
                <div class="estadistica-persona is-${nombre.toLowerCase()}">
                    <span>${nombre}</span>
                    <span>${cant} / ${MAX_OCURRENCIAS}</span>
                </div>
            `;
        });
        rondaDiv.innerHTML = html;
        container.appendChild(rondaDiv);
    }
}

function actualizarDashboard() {
    let ocupados = 0;
    const conteoRondaActual = { "Juan": 0, "Delfina": 0, "Felicitas": 0 };
    const ultimoLavadoGlobal = { "Juan": 0, "Delfina": 0, "Felicitas": 0 };

    Object.values(datosGuardados).forEach(dato => {
        if (dato.nombre) {
            const puntaje = (dato.ronda * 100) + dato.posicion;
            if (puntaje > (ultimoLavadoGlobal[dato.nombre] || 0)) {
                ultimoLavadoGlobal[dato.nombre] = puntaje;
            }
            if (dato.ronda === rondaActual) {
                ocupados++;
                if (conteoRondaActual[dato.nombre] !== undefined) {
                    conteoRondaActual[dato.nombre]++;
                }
            }
        }
    });

    // Barra
    const porcentaje = Math.round((ocupados / TOTAL_LUGARES) * 100);
    const barra = document.getElementById('barra-progreso');
    if (barra) barra.style.width = `${porcentaje}%`;

    const lblPorcentaje = document.getElementById('lbl-porcentaje');
    if (lblPorcentaje) lblPorcentaje.innerText = `${porcentaje}%`;

    const lblRonda = document.getElementById('lbl-ronda-actual');
    if (lblRonda) lblRonda.innerText = rondaActual;

    // Avatars
    const containerStats = document.getElementById('stats-container');
    if (containerStats) {
        containerStats.innerHTML = '';
        OPCIONES.forEach(nombre => {
            const cantidad = conteoRondaActual[nombre] || 0;
            const completo = cantidad >= MAX_OCURRENCIAS;
            containerStats.innerHTML += `
                <div class="stat-item is-${nombre.toLowerCase()} ${completo ? 'completed' : ''}">
                    <div class="stat-circle">${completo ? '✓' : cantidad}</div>
                    <div class="stat-name">${nombre}</div>
                </div>
            `;
        });
    }

    // Le toca a
    let candidatos = OPCIONES.map(nombre => ({
        nombre,
        cantidadActual: conteoRondaActual[nombre] || 0,
        ultimaVez: ultimoLavadoGlobal[nombre] || 0
    })).filter(c => c.cantidadActual < MAX_OCURRENCIAS);

    candidatos.sort((a, b) => {
        if (a.cantidadActual !== b.cantidadActual) return a.cantidadActual - b.cantidadActual;
        return a.ultimaVez - b.ultimaVez;
    });

    const bannerTexto = document.querySelector('#banner-turno span');
    if (bannerTexto) {
        if (candidatos.length > 0) {
            bannerTexto.innerText = candidatos[0].nombre;
            bannerTexto.style.color = `var(--color-${candidatos[0].nombre.toLowerCase()})`;
        } else {
            bannerTexto.innerText = "¡Ronda Completada!";
            bannerTexto.style.color = "#00E676";
        }
    }
}

// --- LISTENERS ---
container.addEventListener("click", (e) => {
    const editBtn = e.target.closest(".editar-btn");
    const delBtn = e.target.closest(".borrar-btn");
    if (editBtn) editarLavado(parseInt(editBtn.getAttribute("data-pos")));
    if (delBtn) borrarLavado(parseInt(delBtn.getAttribute("data-pos")));
});

document.getElementById("btn-juan").addEventListener("click", () => agregarLavadoRapido("Juan"));
document.getElementById("btn-delfina").addEventListener("click", () => agregarLavadoRapido("Delfina"));
document.getElementById("btn-felicitas").addEventListener("click", () => agregarLavadoRapido("Felicitas"));

estadisticasBtn.addEventListener("click", () => {
    mostrandoEstadisticas = !mostrandoEstadisticas;
    lblBtnEstadisticas.textContent = mostrandoEstadisticas ? "Ver Tablero" : "Ver Estadísticas";
    mostrandoEstadisticas ? renderEstadisticas() : renderTodosLosLavados();
});

selectorRonda.addEventListener("change", (e) => {
    rondaActual = parseInt(e.target.value);
    mostrandoEstadisticas ? renderEstadisticas() : renderTodosLosLavados();
});

document.getElementById("btn-prev-ronda").addEventListener("click", () => {
    if (rondaActual > 1) {
        rondaActual--;
        actualizarSelectorRonda();
        mostrandoEstadisticas ? renderEstadisticas() : renderTodosLosLavados();
    }
});

document.getElementById("btn-next-ronda").addEventListener("click", () => {
    if (rondaActual < maxRondas) {
        rondaActual++;
        actualizarSelectorRonda();
        mostrandoEstadisticas ? renderEstadisticas() : renderTodosLosLavados();
    } else {
        maxRondas++;
        rondaActual = maxRondas;
        actualizarSelectorRonda();
        mostrandoEstadisticas ? renderEstadisticas() : renderTodosLosLavados();
        Toast.fire({ icon: 'info', title: `Ronda ${rondaActual} iniciada` });
    }
});

document.getElementById("reiniciar-ronda-btn").addEventListener("click", () => reiniciarRonda(rondaActual));

// --- TIEMPO REAL ---
toggleLoader(true);
onSnapshot(collection(db, "lavados"), (snapshot) => {
    datosGuardados = {};
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const clave = obtenerClaveFirebase(data.ronda || 1, data.posicion);
        datosGuardados[clave] = data;
        if (data.ronda && data.ronda > maxRondas) maxRondas = data.ronda;
    });

    actualizarSelectorRonda();
    if (mostrandoEstadisticas) renderEstadisticas();
    else renderTodosLosLavados();
    toggleLoader(false);
}, (error) => {
    toggleLoader(false);
    console.error("Error al escuchar cambios:", error);
});