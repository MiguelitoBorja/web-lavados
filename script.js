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
let maxRondas = 5; // Empezamos con 5 rondas, pero puede crecer dinámicamente

const container = document.getElementById("lavados-container");
const estadisticasBtn = document.getElementById("estadisticas-btn");
const selectorRonda = document.getElementById("selector-ronda");
let rondaActual = 1;
let datosGuardados = {};
let mostrandoEstadisticas = false;

function obtenerClaseNombre(nombre) {
  const clases = {
    "Juan": "nombre-juan",
    "Delfina": "nombre-delfina", 
    "Felicitas": "nombre-felicitas"
  };
  return clases[nombre] || "";
}

function obtenerClaveFirebase(ronda, posicion) {
  return `ronda${ronda}_lugar${posicion}`;
}

function obtenerClaveDatos(ronda, posicion) {
  return `ronda${ronda}_lugar${posicion}`;
}

function verificarRondaCompleta(ronda) {
  for (let i = 0; i < TOTAL_LUGARES; i++) {
    const clave = obtenerClaveDatos(ronda, i);
    if (!datosGuardados[clave]) {
      return false;
    }
  }
  return true;
}

function obtenerRondasDisponibles() {
  const rondas = [];
  for (let i = 1; i <= maxRondas; i++) {
    rondas.push(i);
  }
  return rondas;
}

function actualizarSelectorRonda() {
  const rondaSeleccionada = selectorRonda.value;
  selectorRonda.innerHTML = '';
  
  const rondasDisponibles = obtenerRondasDisponibles();
  
  // Solo mostrar rondas activas (no finalizadas)
  const rondasActivas = rondasDisponibles.filter(ronda => !verificarRondaCompleta(ronda));
  
  // Si no hay rondas activas, mostrar la última ronda
  if (rondasActivas.length === 0) {
    rondasActivas.push(maxRondas);
  }
  
  rondasActivas.forEach(ronda => {
    const option = document.createElement('option');
    option.value = ronda;
    option.textContent = `Ronda ${ronda}`;
    option.style.color = '#2d3748';
    option.style.fontWeight = '600';
    selectorRonda.appendChild(option);
  });
  
  // Mantener la ronda seleccionada si es posible y está activa
  if (rondaSeleccionada && rondasActivas.includes(parseInt(rondaSeleccionada))) {
    selectorRonda.value = rondaSeleccionada;
  } else {
    // Si no, seleccionar la primera ronda activa
    rondaActual = rondasActivas[0];
    selectorRonda.value = rondasActivas[0];
  }
}

function verificarYAgregarNuevaRonda() {
  // Verificar si la ronda actual está completa
  if (verificarRondaCompleta(rondaActual)) {
    // Agregar una nueva ronda si no existe
    const siguienteRonda = maxRondas + 1;
    maxRondas = siguienteRonda;
    
    // Actualizar el selector de ronda
    actualizarSelectorRonda();
    
    // Cambiar automáticamente a la nueva ronda
    rondaActual = siguienteRonda;
    selectorRonda.value = siguienteRonda;
    
    // Mostrar mensaje de felicitación más elegante
    mostrarNotificacionRonda(`¡Ronda ${rondaActual - 1} completada! Se ha creado la Ronda ${rondaActual}`);
    
    return true;
  }
  return false;
}

function encontrarProximoLugarLibre(ronda) {
  for (let i = 0; i < TOTAL_LUGARES; i++) {
    const clave = obtenerClaveDatos(ronda, i);
    if (!datosGuardados[clave] || !datosGuardados[clave].nombre) {
      return i;
    }
  }
  return -1; // No hay lugares libres
}

async function agregarLavadoRapido(nombre) {
  const fechaHoy = new Date().toISOString().split('T')[0];
  const horaActual = new Date().getHours();
  
  // Determinar turno según la hora (antes de las 17:00 = mediodía, después = noche)
  const turno = horaActual < 17 ? "mediodia" : "noche";
  
  // Verificar límite de ocurrencias en la ronda actual
  const snapshot = await getDocs(collection(db, "lavados"));
  const conteoRondaActual = {};
  snapshot.forEach(docSnap => {
    const dato = docSnap.data();
    if (dato.nombre && dato.ronda === rondaActual) {
      conteoRondaActual[dato.nombre] = (conteoRondaActual[dato.nombre] || 0) + 1;
    }
  });

  // Buscar lugar libre en la ronda actual
  let lugarLibre = encontrarProximoLugarLibre(rondaActual);
  let rondaParaUsar = rondaActual;
  let razonCambioRonda = "";

  // Si ya tiene 5 lavados en la ronda actual, pasar automáticamente a la siguiente
  if (conteoRondaActual[nombre] >= MAX_OCURRENCIAS) {
    rondaParaUsar = rondaActual + 1;
    lugarLibre = encontrarProximoLugarLibre(rondaParaUsar);
    razonCambioRonda = "limite_lavados";
    
    // Si la nueva ronda no existe, crearla
    if (rondaParaUsar > maxRondas) {
      maxRondas = rondaParaUsar;
      actualizarSelectorRonda();
    }
  }
  // Si no hay lugar en la ronda actual, buscar en la siguiente
  else if (lugarLibre === -1) {
    rondaParaUsar = rondaActual + 1;
    lugarLibre = encontrarProximoLugarLibre(rondaParaUsar);
    razonCambioRonda = "ronda_completa";
    
    // Si la nueva ronda no existe, crearla
    if (rondaParaUsar > maxRondas) {
      maxRondas = rondaParaUsar;
      actualizarSelectorRonda();
    }
  }
  
  if (lugarLibre === -1) {
    alert(`No hay lugares libres en las rondas ${rondaActual} y ${rondaParaUsar}`);
    return;
  }
  if (conteoRondaActual[nombre] >= MAX_OCURRENCIAS) {
    rondaParaUsar = rondaActual + 1;
    lugarLibre = encontrarProximoLugarLibre(rondaParaUsar);
    
    // Si la nueva ronda no existe, crearla
    if (rondaParaUsar > maxRondas) {
      maxRondas = rondaParaUsar;
      actualizarSelectorRonda();
    }
    
    if (lugarLibre === -1) {
      alert(`No hay lugares libres en la ronda ${rondaParaUsar}`);
      return;
    }
  }
  
  // Guardar el lavado
  await setDoc(doc(db, "lavados", obtenerClaveFirebase(rondaParaUsar, lugarLibre)), {
    ronda: rondaParaUsar,
    posicion: lugarLibre,
    nombre: nombre,
    fecha: fechaHoy,
    turno: turno // Turno determinado por la hora
  });
  
  // Si se agregó a una ronda diferente, cambiar a esa ronda
  if (rondaParaUsar !== rondaActual) {
    const rondaAnterior = rondaActual;
    rondaActual = rondaParaUsar;
    selectorRonda.value = rondaParaUsar;
    
    // Verificar si fue por límite de lavados o por ronda completa
    if (razonCambioRonda === "limite_lavados") {
      alert(`${nombre} ya completó 5 lavados en la Ronda ${rondaAnterior}. Se agregó automáticamente a la Ronda ${rondaParaUsar} - Lugar ${lugarLibre + 1}`);
    } else {
      alert(`Ronda ${rondaAnterior} completa. Se agregó ${nombre} a la Ronda ${rondaParaUsar} - Lugar ${lugarLibre + 1}`);
    }
  } else {
    alert(`Se agregó ${nombre} a la Ronda ${rondaParaUsar} - Lugar ${lugarLibre + 1}`);
  }
  
  // Actualizar la vista para mostrar los cambios
  await cargarDatos();
  renderTodosLosLavados();
}

async function reiniciarRonda(ronda) {
  try {
    // Borrar todos los documentos de la ronda especificada
    for (let i = 0; i < TOTAL_LUGARES; i++) {
      const claveFirebase = obtenerClaveFirebase(ronda, i);
      const clave = obtenerClaveDatos(ronda, i);
      
      // Eliminar de Firebase
      await setDoc(doc(db, "lavados", claveFirebase), {
        ronda: ronda,
        posicion: i,
        nombre: "",
        fecha: "",
        turno: ""
      });
      
      // Eliminar de datos locales
      delete datosGuardados[clave];
    }
    
    // Renderizar según el modo actual
    if (mostrandoEstadisticas) {
      renderEstadisticas();
    } else {
      renderTodosLosLavados();
    }
    
    alert(`Ronda ${ronda} reiniciada exitosamente`);
    
  } catch (error) {
    console.error("Error al reiniciar la ronda:", error);
    alert("Error al reiniciar la ronda. Inténtalo de nuevo.");
  }
}

function calcularEstadisticas() {
  const estadisticas = {};
  
  // Inicializar estadísticas para todas las rondas disponibles
  for (let ronda = 1; ronda <= maxRondas; ronda++) {
    estadisticas[ronda] = {
      "Juan": 0,
      "Delfina": 0,
      "Felicitas": 0
    };
  }
  
  // Contar lavados por persona y ronda
  Object.keys(datosGuardados).forEach(clave => {
    const data = datosGuardados[clave];
    if (data && data.nombre && data.ronda) {
      if (!estadisticas[data.ronda]) {
        estadisticas[data.ronda] = {
          "Juan": 0,
          "Delfina": 0,
          "Felicitas": 0
        };
      }
      estadisticas[data.ronda][data.nombre]++;
    }
  });
  
  return estadisticas;
}

function renderEstadisticas() {
  container.innerHTML = "";
  container.className = "estadisticas-container"; // Clase específica para estadísticas
  
  const estadisticas = calcularEstadisticas();
  
  for (let ronda = 1; ronda <= maxRondas; ronda++) {
    const rondaDiv = document.createElement("div");
    const esCompleta = verificarRondaCompleta(ronda);
    rondaDiv.className = esCompleta ? "estadisticas-ronda ronda-finalizada" : "estadisticas-ronda";
    
    let html = `<h3>Ronda ${ronda}${esCompleta ? ' - FINALIZADA' : ''}</h3>`;
    
    // Mostrar estadísticas por persona
    OPCIONES.forEach(nombre => {
      const cantidad = estadisticas[ronda] ? estadisticas[ronda][nombre] : 0;
      const clasePersona = `estadistica-${nombre.toLowerCase()}`;
      html += `
        <div class="estadistica-persona ${clasePersona}">
          <span>${nombre}</span>
          <span>${cantidad} lavado${cantidad !== 1 ? 's' : ''}</span>
        </div>
      `;
    });
    
    rondaDiv.innerHTML = html;
    container.appendChild(rondaDiv);
  }
}

async function editarLavado(posicion) {
  const clave = obtenerClaveDatos(rondaActual, posicion);
  const data = datosGuardados[clave];
  
  if (!data || !data.nombre) {
    alert("No hay datos para editar en esta posición");
    return;
  }
  
  // Crear formulario de edición
  const nuevoNombre = prompt("Nombre:", data.nombre);
  if (nuevoNombre === null) return; // Usuario canceló
  
  const nuevaFecha = prompt("Fecha (YYYY-MM-DD):", data.fecha);
  if (nuevaFecha === null) return; // Usuario canceló
  
  const nuevoTurno = prompt("Turno (mediodia/noche):", data.turno);
  if (nuevoTurno === null) return; // Usuario canceló
  
  // Validaciones
  if (!nuevoNombre || !nuevaFecha || !nuevoTurno) {
    alert("Todos los campos son obligatorios");
    return;
  }
  
  if (!OPCIONES.includes(nuevoNombre)) {
    alert("El nombre debe ser: " + OPCIONES.join(", "));
    return;
  }
  
  if (!["mediodia", "noche"].includes(nuevoTurno)) {
    alert("El turno debe ser 'mediodia' o 'noche'");
    return;
  }
  
  // Verificar límite de ocurrencias (excluyendo el actual)
  const snapshot = await getDocs(collection(db, "lavados"));
  const conteo = {};
  snapshot.forEach(docSnap => {
    const dato = docSnap.data();
    if (dato.nombre && dato.nombre !== data.nombre) {
      conteo[dato.nombre] = (conteo[dato.nombre] || 0) + 1;
    }
  });

  if ((conteo[nuevoNombre] || 0) >= MAX_OCURRENCIAS) {
    alert(`Ya se usó "${nuevoNombre}" 5 veces. Elegí otro nombre.`);
    return;
  }
  
  // Actualizar en Firebase
  await setDoc(doc(db, "lavados", obtenerClaveFirebase(rondaActual, posicion)), {
    ronda: rondaActual,
    posicion: posicion,
    nombre: nuevoNombre,
    fecha: nuevaFecha,
    turno: nuevoTurno
  });
  
  alert("Lavado editado exitosamente");
}

async function borrarLavado(posicion) {
  const clave = obtenerClaveDatos(rondaActual, posicion);
  const data = datosGuardados[clave];
  
  if (!data || !data.nombre) {
    alert("No hay datos para borrar en esta posición");
    return;
  }
  
  if (confirm(`¿Estás seguro de que quieres borrar el lavado de ${data.nombre} en el Lugar ${posicion + 1}?`)) {
    // Borrar de Firebase
    await setDoc(doc(db, "lavados", obtenerClaveFirebase(rondaActual, posicion)), {
      ronda: rondaActual,
      posicion: posicion,
      nombre: "",
      fecha: "",
      turno: ""
    });
    
    alert("Lavado borrado exitosamente");
  }
}

function renderTodosLosLavados() {
  container.innerHTML = "";
  container.className = "vista-todas"; // Agregar clase para vista compacta
  
  for (let i = 0; i < TOTAL_LUGARES; i++) {
    const clave = obtenerClaveDatos(rondaActual, i);
    const data = datosGuardados[clave] || {};
    const div = document.createElement("div");
    
    if (data.nombre) {
      // Lugar ocupado - mostrar información con color (inicialmente colapsado)
      const claseColor = obtenerClaseNombre(data.nombre);
      div.className = `select-box collapsed ${claseColor}`;
      div.innerHTML = `
        <label>
          Ronda ${rondaActual} - Lugar ${i + 1}
          <span class="expand-indicator">▼</span>
        </label>
        <div class="estado-resumen">${data.nombre}</div>
        <div class="info-completa">
          <p><strong>${data.nombre}</strong></p>
          <p>${data.fecha}</p>
          <p>${data.turno}</p>
          <div class="botones-accion">
            <button class="editar-btn" data-pos="${i}">Editar</button>
            <button class="borrar-btn" data-pos="${i}">Borrar</button>
          </div>
        </div>
      `;
    } else {
      // Lugar libre - mostrar formulario (inicialmente colapsado)
      div.className = "select-box collapsed";
      div.innerHTML = `
        <label>
          Ronda ${rondaActual} - Lugar ${i + 1}
          <span class="expand-indicator">▼</span>
        </label>
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
            <option value="">Elegir turno...</option>
            <option value="mediodia">Mediodía</option>
            <option value="noche">Noche</option>
          </select>
          <button class="guardar-btn" data-pos="${i}">Guardar</button>
        </div>
      `;
    }
    
    // Agregar event listener para toggle
    div.addEventListener('click', function(e) {
      // No toggle si se hace clic en un elemento del formulario
      if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') {
        return;
      }
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
    
    // Obtener la posición del botón
    const posicion = parseInt(e.target.getAttribute("data-pos"));

    if (!nombre || !fecha || !turno) {
      alert("Completá todos los campos.");
      return;
    }

    // Obtener todos los docs
    const snapshot = await getDocs(collection(db, "lavados"));
    const conteo = {};
    snapshot.forEach(docSnap => {
      const dato = docSnap.data();
      conteo[dato.nombre] = (conteo[dato.nombre] || 0) + 1;
    });

    if (conteo[nombre] >= MAX_OCURRENCIAS) {
      alert(`Ya se usó "${nombre}" 5 veces. Elegí otro nombre.`);
      return;
    }

    await setDoc(doc(db, "lavados", obtenerClaveFirebase(rondaActual, posicion)), {
      ronda: rondaActual,
      posicion: posicion,
      nombre,
      fecha,
      turno
    });

    // Verificar si se completó la ronda y agregar nueva si es necesario
    setTimeout(() => {
      verificarYAgregarNuevaRonda();
    }, 500); // Pequeño delay para asegurar que los datos se actualicen
  }
  
  if (e.target.classList.contains("editar-btn")) {
    const posicion = parseInt(e.target.getAttribute("data-pos"));
    await editarLavado(posicion);
  }
  
  if (e.target.classList.contains("borrar-btn")) {
    const posicion = parseInt(e.target.getAttribute("data-pos"));
    await borrarLavado(posicion);
  }
});

// Event listeners para los botones de nombres rápidos
document.getElementById("btn-juan").addEventListener("click", function() {
  agregarLavadoRapido("Juan");
});

document.getElementById("btn-delfina").addEventListener("click", function() {
  agregarLavadoRapido("Delfina");
});

document.getElementById("btn-felicitas").addEventListener("click", function() {
  agregarLavadoRapido("Felicitas");
});

// Event listener para el botón "Ver Estadísticas"
estadisticasBtn.addEventListener("click", function() {
  mostrandoEstadisticas = !mostrandoEstadisticas;
  
  if (mostrandoEstadisticas) {
    // Entrar en modo estadísticas
    estadisticasBtn.textContent = "Volver";
    renderEstadisticas();
  } else {
    // Salir del modo estadísticas
    estadisticasBtn.textContent = "Ver Estadísticas";
    renderTodosLosLavados();
  }
});

// Event listener para el selector de ronda
selectorRonda.addEventListener("change", function() {
  const nuevaRonda = parseInt(this.value);
  if (!isNaN(nuevaRonda)) {
    rondaActual = nuevaRonda;
    
    // Renderizar según el modo actual
    if (mostrandoEstadisticas) {
      renderEstadisticas();
    } else {
      renderTodosLosLavados();
    }
  }
});

// Event listener para el botón de reiniciar ronda
document.getElementById("reiniciar-ronda-btn").addEventListener("click", async function() {
  if (confirm(`¿Estás seguro de que quieres reiniciar la Ronda ${rondaActual}? Se borrarán todos los datos de esta ronda.`)) {
    await reiniciarRonda(rondaActual);
  }
});

function actualizarUI() {
  onSnapshot(collection(db, "lavados"), (snapshot) => {
    datosGuardados = {};
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const clave = obtenerClaveDatos(data.ronda || 1, data.posicion);
      datosGuardados[clave] = data;
      
      // Actualizar maxRondas si encontramos una ronda mayor
      if (data.ronda && data.ronda > maxRondas) {
        maxRondas = data.ronda;
      }
    });
    
    // Actualizar selector de ronda
    actualizarSelectorRonda();
    
    // Renderizar según el modo actual (siempre mostrar todos los lavados por defecto)
    if (mostrandoEstadisticas) {
      renderEstadisticas();
    } else {
      renderTodosLosLavados();
    }
  });
}

// Función global para el botón "Hoy"
window.setHoy = function(boton) {
  const fechaInput = boton.parentElement.querySelector('.fecha-input');
  const hoy = new Date();
  const fechaHoy = hoy.toISOString().split('T')[0];
  fechaInput.value = fechaHoy;
  
  // Agregar animación visual
  boton.style.transform = 'scale(0.95)';
  setTimeout(() => {
    boton.style.transform = 'scale(1)';
  }, 150);
}

// Función para mostrar notificaciones elegantes
function mostrarNotificacionRonda(mensaje) {
  // Crear elemento de notificación
  const notificacion = document.createElement('div');
  notificacion.className = 'notificacion-ronda';
  notificacion.innerHTML = `
    <div class="notificacion-icono">🎉</div>
    <div class="notificacion-mensaje">${mensaje}</div>
  `;
  
  // Agregar al body
  document.body.appendChild(notificacion);
  
  // Mostrar con animación
  setTimeout(() => {
    notificacion.classList.add('mostrar');
  }, 100);
  
  // Ocultar después de 4 segundos
  setTimeout(() => {
    notificacion.classList.remove('mostrar');
    setTimeout(() => {
      document.body.removeChild(notificacion);
    }, 500);
  }, 4000);
}

// Inicializar el selector de ronda al cargar
actualizarSelectorRonda();

actualizarUI();
