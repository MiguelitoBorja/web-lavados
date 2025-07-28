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
const mostrarTodosBtn = document.getElementById("mostrar-todos-btn");
const estadisticasBtn = document.getElementById("estadisticas-btn");
const selectorLugar = document.getElementById("selector-lugar");
const selectorRonda = document.getElementById("selector-ronda");
let posicionActual = 0;
let rondaActual = 1;
let datosGuardados = {};
let mostrandoTodos = false;
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
  rondasDisponibles.forEach(ronda => {
    const esCompleta = verificarRondaCompleta(ronda);
    const texto = esCompleta ? `Ronda ${ronda} - FINALIZADA` : `Ronda ${ronda}`;
    const option = document.createElement('option');
    option.value = ronda;
    option.textContent = texto;
    option.style.color = esCompleta ? '#28a745' : '#2d3748';
    option.style.fontWeight = esCompleta ? 'bold' : 'normal';
    selectorRonda.appendChild(option);
  });
  
  // Mantener la ronda seleccionada si es posible
  if (rondaSeleccionada && rondaSeleccionada <= maxRondas) {
    selectorRonda.value = rondaSeleccionada;
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
    posicionActual = 0;
    
    // Mostrar mensaje de felicitación
    alert(`¡Ronda ${rondaActual - 1} completada! Se ha creado la Ronda ${rondaActual}`);
    
    return true;
  }
  return false;
}

function encontrarProximoLugarLibre() {
  for (let i = 0; i < TOTAL_LUGARES; i++) {
    const clave = obtenerClaveDatos(rondaActual, i);
    if (!datosGuardados[clave]) {
      return i;
    }
  }
  return 0; // Si todos están ocupados, volver al primero
}

function poblarSelectorLugar() {
  selectorLugar.innerHTML = '<option value="">Ir a lugar específico...</option>';
  for (let i = 0; i < TOTAL_LUGARES; i++) {
    const clave = obtenerClaveDatos(rondaActual, i);
    const data = datosGuardados[clave];
    const estado = data ? `(${data.nombre})` : '(LIBRE)';
    selectorLugar.innerHTML += `<option value="${i}">Lugar ${i + 1} ${estado}</option>`;
  }
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
    
    // Resetear posición actual al primer lugar libre
    posicionActual = 0;
    
    // Actualizar selector de lugar
    poblarSelectorLugar();
    
    // Renderizar según el modo actual
    if (mostrandoEstadisticas) {
      renderEstadisticas();
    } else if (mostrandoTodos) {
      renderTodosLosLavados();
    } else {
      renderRecuadro(posicionActual);
    }
    
    alert(`Ronda ${ronda} reiniciada exitosamente`);
    
  } catch (error) {
    console.error("Error al reiniciar la ronda:", error);
    alert("Error al reiniciar la ronda. Inténtalo de nuevo.");
  }
}

function renderRecuadro(pos) {
  container.innerHTML = "";
  container.className = ""; // Limpiar clases del contenedor
  const clave = obtenerClaveDatos(rondaActual, pos);
  const data = datosGuardados[clave] || {};
  const div = document.createElement("div");
  
  // Aplicar color si hay datos guardados
  const claseColor = data.nombre ? obtenerClaseNombre(data.nombre) : "";
  div.className = `select-box ${claseColor}`;
  
  div.innerHTML = `
    <label>Ronda ${rondaActual} - Lugar ${pos + 1}</label>
    <select class="nombre-select">
      <option value="">Elegir nombre...</option>
      ${OPCIONES.map(o => `<option value="${o}" ${data.nombre === o ? "selected" : ""}>${o}</option>`).join("")}
    </select>
    <div class="fecha-container">
      <input type="date" class="fecha-input" value="${data.fecha || ""}" />
      <button type="button" class="hoy-btn" onclick="setHoy(this)">Hoy</button>
    </div>
    <select class="turno-select">
      <option value="">Elegir turno...</option>
      <option value="mañana" ${data.turno === "mañana" ? "selected" : ""}>Mañana</option>
      <option value="tarde" ${data.turno === "tarde" ? "selected" : ""}>Tarde</option>
    </select>
    <button class="guardar-btn">Guardar</button>
  `;
  container.appendChild(div);
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

function renderTodosLosLavados() {
  container.innerHTML = "";
  container.className = "vista-todas"; // Agregar clase para vista compacta
  
  for (let i = 0; i < TOTAL_LUGARES; i++) {
    const clave = obtenerClaveDatos(rondaActual, i);
    const data = datosGuardados[clave] || {};
    const div = document.createElement("div");
    div.className = "select-box";
    
    if (data.nombre) {
      // Lugar ocupado - mostrar información con color
      const claseColor = obtenerClaseNombre(data.nombre);
      div.className = `select-box ${claseColor}`;
      div.innerHTML = `
        <label>Ronda ${rondaActual} - Lugar ${i + 1}</label>
        <div class="info-completa">
          <p><strong>${data.nombre}</strong></p>
          <p>${data.fecha}</p>
          <p>${data.turno}</p>
        </div>
      `;
    } else {
      // Lugar libre - mostrar formulario
      div.innerHTML = `
        <label>Ronda ${rondaActual} - Lugar ${i + 1} - LIBRE</label>
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
          <option value="mañana">Mañana</option>
          <option value="tarde">Tarde</option>
        </select>
        <button class="guardar-btn" data-pos="${i}">Guardar</button>
      `;
    }
    
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
    const posicion = mostrandoTodos ? 
      parseInt(e.target.getAttribute("data-pos")) : 
      posicionActual;

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
      const nuevaRondaCreada = verificarYAgregarNuevaRonda();
      
      if (!mostrandoTodos && !nuevaRondaCreada) {
        // Solo avanzar al siguiente lugar si no se creó una nueva ronda
        if (posicionActual < TOTAL_LUGARES - 1) {
          posicionActual++;
          renderRecuadro(posicionActual);
        } else {
          alert("¡Todos los lugares de esta ronda completados!");
        }
      }
    }, 500); // Pequeño delay para asegurar que los datos se actualicen
  }
});

// Event listener para el botón "Ver Todos los Lavados"
mostrarTodosBtn.addEventListener("click", function() {
  if (mostrandoEstadisticas) {
    // Si estamos en estadísticas, volver al modo normal
    mostrandoEstadisticas = false;
    estadisticasBtn.textContent = "Ver Estadísticas";
    container.className = "";
  }
  
  mostrandoTodos = !mostrandoTodos;
  
  if (mostrandoTodos) {
    mostrarTodosBtn.textContent = "Vista Individual";
    renderTodosLosLavados();
  } else {
    mostrarTodosBtn.textContent = "Ver Todos los Lavados";
    renderRecuadro(posicionActual);
  }
});

// Event listener para el botón "Ver Estadísticas"
estadisticasBtn.addEventListener("click", function() {
  mostrandoEstadisticas = !mostrandoEstadisticas;
  
  if (mostrandoEstadisticas) {
    // Entrar en modo estadísticas
    estadisticasBtn.textContent = "Volver";
    mostrarTodosBtn.textContent = "Ver Todos los Lavados";
    mostrandoTodos = false;
    renderEstadisticas();
  } else {
    // Salir del modo estadísticas
    estadisticasBtn.textContent = "Ver Estadísticas";
    container.className = "";
    renderRecuadro(posicionActual);
  }
});

// Event listener para el selector de lugar
selectorLugar.addEventListener("change", function() {
  const lugarSeleccionado = parseInt(this.value);
  if (!isNaN(lugarSeleccionado)) {
    posicionActual = lugarSeleccionado;
    if (!mostrandoTodos) {
      renderRecuadro(posicionActual);
    }
    this.value = ""; // Resetear el selector
  }
});

// Event listener para el selector de ronda
selectorRonda.addEventListener("change", function() {
  const nuevaRonda = parseInt(this.value);
  if (!isNaN(nuevaRonda)) {
    rondaActual = nuevaRonda;
    posicionActual = encontrarProximoLugarLibre();
    
    // Actualizar selector de lugar
    poblarSelectorLugar();
    
    // Renderizar según el modo actual
    if (mostrandoEstadisticas) {
      renderEstadisticas();
    } else if (mostrandoTodos) {
      renderTodosLosLavados();
    } else {
      renderRecuadro(posicionActual);
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
    
    // Actualizar selector de lugar
    poblarSelectorLugar();
    
    // Si es la primera carga, ir al próximo lugar libre
    if (posicionActual === 0 && Object.keys(datosGuardados).length > 0) {
      posicionActual = encontrarProximoLugarLibre();
    }
    
    // Renderizar según el modo actual
    if (mostrandoEstadisticas) {
      renderEstadisticas();
    } else if (mostrandoTodos) {
      renderTodosLosLavados();
    } else {
      renderRecuadro(posicionActual);
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

// Inicializar el selector de ronda al cargar
actualizarSelectorRonda();

actualizarUI();
