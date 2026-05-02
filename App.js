// Importamos React y los hooks para manejar el estado y el inicio de la app
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, Platform, Alert } from 'react-native';

// Importamos nuestras herramientas externas
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';

// 1. Configuración de notificaciones: Le decimos a la app que muestre alerta visual y sonido
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  // --- FUNCIÓN AUXILIAR PARA LA FECHA ---
  const obtenerFechaPorDefecto = () => {
    const fecha = new Date();
    fecha.setMinutes(fecha.getMinutes() + 5);
    return fecha;
  };

  // --- ESTADOS ---
  const [tareaTexto, setTareaTexto] = useState(''); 
  const [tareas, setTareas] = useState([]); 
  const [fechaSeleccionada, setFechaSeleccionada] = useState(obtenerFechaPorDefecto()); 
  const [mostrarSelector, setMostrarSelector] = useState(false); 
  const [modoSelector, setModoSelector] = useState('date'); 

  // --- USE EFFECT (Cargar datos y pedir permisos al abrir la app) ---
  useEffect(() => {
    const configurarNotificaciones = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Aviso', 'Las notificaciones no funcionarán sin permisos.');
      }

      // --- SOLUCIÓN: CONFIGURACIÓN DE CANAL PARA ANDROID ---
      // Esto es obligatorio en las versiones nuevas para evitar el error de Trigger
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Mis Tareas',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#3182CE',
        });
      }
    };

    const cargarTareas = async () => {
      try {
        const tareasGuardadas = await AsyncStorage.getItem('@mis_tareas');
        if (tareasGuardadas !== null) {
          setTareas(JSON.parse(tareasGuardadas));
        }
      } catch (error) {
        console.log("Error al cargar tareas:", error);
      }
    };

    configurarNotificaciones();
    cargarTareas();
  }, []);

  // --- FUNCIÓN PARA GUARDAR EN LA MEMORIA DEL TELÉFONO ---
  const guardarTareas = async (nuevasTareas) => {
    try {
      const tareasEnTexto = JSON.stringify(nuevasTareas);
      await AsyncStorage.setItem('@mis_tareas', tareasEnTexto);
    } catch (error) {
      console.log("Error al guardar en memoria:", error);
    }
  };

  // --- MANEJO DEL CALENDARIO Y RELOJ ---
  const alCambiarFecha = (event, fechaElegida) => {
    const fechaActual = fechaElegida || fechaSeleccionada;
    setMostrarSelector(Platform.OS === 'ios'); 
    setFechaSeleccionada(fechaActual);
  };

  const abrirCalendario = () => { setModoSelector('date'); setMostrarSelector(true); };
  const abrirReloj = () => { setModoSelector('time'); setMostrarSelector(true); };

  // --- FUNCIÓN PRINCIPAL PARA AGREGAR TAREA ---
  const agregarTarea = async () => {
    console.log("1. Intentando guardar tarea:", tareaTexto);

    if (tareaTexto.trim() === '') {
      Alert.alert('Error', 'Escribe algo antes de guardar.');
      return;
    }

    if (fechaSeleccionada <= new Date()) {
      Alert.alert('Error de Fecha', 'La hora elegida ya pasó. Elige una hora en el futuro.');
      return;
    }

    try {
      console.log("2. Programando notificación...");
      
      // --- SOLUCIÓN APLICADA AL TRIGGER ---
      // Pasamos la fecha explícita y el channelId que creamos en el useEffect
      const idNotificacion = await Notifications.scheduleNotificationAsync({
        content: {
          title: "¡Recordatorio de Tarea!",
          body: tareaTexto,
          sound: true,
        },
        trigger: {
          date: new Date(fechaSeleccionada),
          channelId: 'default', // <- Esto evita el error rojo que te apareció
        },
      });

      console.log("3. Notificación lista. ID:", idNotificacion);

      const nuevaTarea = {
        id: Date.now().toString(),
        texto: tareaTexto,
        completada: false,
        fecha: fechaSeleccionada.toString(), 
        idNotificacion: idNotificacion, 
      };

      const nuevasTareas = [...tareas, nuevaTarea];
      setTareas(nuevasTareas);
      guardarTareas(nuevasTareas);
      
      setTareaTexto('');
      setFechaSeleccionada(obtenerFechaPorDefecto());
      
      console.log("4. ¡Tarea guardada con éxito!");

    } catch (error) {
      console.error("ERROR AL GUARDAR:", error);
      Alert.alert('Error técnico', 'Hubo un error al programar la alarma.');
    }
  };

  // --- FUNCIÓN PARA BORRAR TAREA ---
  const eliminarTarea = async (id, idNotificacion) => {
    if (idNotificacion) {
      await Notifications.cancelScheduledNotificationAsync(idNotificacion);
    }

    const tareasRestantes = tareas.filter((tarea) => tarea.id !== id);
    setTareas(tareasRestantes);
    guardarTareas(tareasRestantes);
  };

  // --- DISEÑO DE CADA TAREA EN LA LISTA ---
  const renderItem = ({ item }) => {
    const fechaFormateada = new Date(item.fecha);

    return (
      <View style={styles.tareaContainer}>
        <View style={styles.textoContainer}>
          <Text style={styles.textoTarea}>{item.texto}</Text>
          <Text style={styles.textoFecha}>
            {fechaFormateada.toLocaleDateString()} - {fechaFormateada.toLocaleTimeString()}
          </Text>
        </View>
        
        <TouchableOpacity onPress={() => eliminarTarea(item.id, item.idNotificacion)} style={styles.botonEliminar}>
          <Text style={styles.textoEliminar}>X</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // --- LA PANTALLA PRINCIPAL ---
  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Mis Tareas y Alertas</Text>

      <TextInput
        style={styles.input}
        placeholder="¿Qué necesitas recordar?"
        value={tareaTexto}
        onChangeText={setTareaTexto}
      />

      <View style={styles.botonesFechaContainer}>
        <TouchableOpacity style={styles.botonFecha} onPress={abrirCalendario}>
          <Text style={styles.textoBotonSecundario}>Elegir Día</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.botonFecha} onPress={abrirReloj}>
          <Text style={styles.textoBotonSecundario}>Elegir Hora</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.textoConfirmacionFecha}>
        Avisar el: {fechaSeleccionada.toLocaleDateString()} a las {fechaSeleccionada.toLocaleTimeString()}
      </Text>

      <TouchableOpacity style={styles.botonAgregar} onPress={agregarTarea}>
        <Text style={styles.textoBotonAgregar}>Guardar Tarea y Programar Aviso</Text>
      </TouchableOpacity>

      {mostrarSelector && (
        <DateTimePicker
          value={fechaSeleccionada}
          mode={modoSelector}
          is24Hour={true}
          display="default"
          onChange={alCambiarFecha}
        />
      )}

      <FlatList
        data={tareas}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        style={{ marginTop: 20 }}
      />
    </View>
  );
}

// --- ESTILOS VISUALES ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F4F8',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  titulo: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#2C3E50',
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D9E6',
    fontSize: 16,
    marginBottom: 10,
  },
  botonesFechaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  botonFecha: {
    backgroundColor: '#E2E8F0',
    padding: 12,
    borderRadius: 8,
    flex: 0.48,
    alignItems: 'center',
  },
  textoBotonSecundario: {
    color: '#4A5568',
    fontWeight: 'bold',
  },
  textoConfirmacionFecha: {
    textAlign: 'center',
    color: '#718096',
    marginBottom: 15,
    fontStyle: 'italic',
  },
  botonAgregar: {
    backgroundColor: '#3182CE',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  textoBotonAgregar: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tareaContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 5,
    borderLeftColor: '#3182CE',
  },
  textoContainer: {
    flex: 1,
  },
  textoTarea: {
    fontSize: 18,
    color: '#2D3748',
    fontWeight: '500',
  },
  textoFecha: {
    fontSize: 12,
    color: '#A0AEC0',
    marginTop: 4,
  },
  botonEliminar: {
    backgroundColor: '#E53E3E',
    width: 35,
    height: 35,
    borderRadius: 17.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textoEliminar: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});