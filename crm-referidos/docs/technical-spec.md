# Documento Técnico
## Sistema Web de Gestión de Referidos y Conversión de Reuniones

### Versión
1.0

### Fecha
07 Mayo 2026

---

# 1. Objetivo del Proyecto

Desarrollar una plataforma web orientada a la gestión de prospectos y referidos para un negocio de inversiones inmobiliarias, enfocada en mejorar el seguimiento comercial y aumentar la conversión de reuniones con potenciales inversionistas.

El sistema permitirá registrar leads, realizar seguimiento mediante un pipeline guiado, administrar recordatorios, registrar historial de acciones y generar reportes básicos de conversión.

---

# 2. Objetivo de Negocio

Actualmente el proceso comercial depende principalmente de:

- Referidos boca a boca
- Seguimiento manual por WhatsApp
- Memoria del asesor
- Gestión parcial mediante Excel

El objetivo principal del sistema es:

> Convertir prospectos en reuniones de forma organizada y medible.

---

# 3. Alcance Inicial (MVP)

## Incluye

- Gestión de leads / prospectos
- Registro manual y mediante formulario
- Pipeline visual de seguimiento
- Gestión de estados
- Recordatorios internos
- Historial de acciones
- Notas múltiples por lead
- Dashboard principal
- Reportes básicos
- Roles y usuarios
- Integración inicial con WhatsApp mediante links prellenados
- Integración con Calendly

## No incluye en esta fase

- Aplicación móvil
- IA
- WhatsApp API automática
- Automatizaciones avanzadas
- Integraciones con CRM externos
- Campañas masivas

---

# 4. Arquitectura General

## Tipo de aplicación

Aplicación web responsiva.

## Arquitectura sugerida

### Frontend
- React
- Vue
- Angular

(Recomendación: React)

### Backend
- Node.js + Express

Alternativas:
- Laravel
- Django

### Base de Datos
- PostgreSQL

Alternativa:
- MySQL

### Hosting
- VPS Linux
- Docker opcional

---

# 5. Concepto Principal del Sistema

El sistema funciona mediante un pipeline guiado.

Cada lead (card) avanza por diferentes estados comerciales.

El usuario no depende de mover manualmente el card entre columnas tipo Kanban libre, sino que el sistema guía el flujo mediante acciones y botones internos.

---

# 6. Pipeline Inicial

## Estados Principales

1. Nuevo
2. Contactado
3. Respondió
4. Agendada
5. Cierre

## Subestados de Cierre

- Invirtió
- No invirtió (temporal)
- No invirtió (definitivo)

---

# 7. Reglas del Pipeline

## Reglas generales

- Cada estado corresponde a una columna visual.
- Al cambiar estado, el card cambia automáticamente de columna.
- El sistema debe guiar el siguiente paso.

## Flujo esperado

Nuevo → Contactado → Respondió → Agendada → Cierre

## Restricciones

### Restricción obligatoria

No se puede cerrar un lead sin:

- Seleccionar resultado final
- Registrar motivo si no invirtió

## Flexibilidad

Se permitirá avanzar manualmente a otro estado bajo ciertas condiciones mediante advertencias suaves.

---

# 8. Gestión de Leads

## Formas de ingreso

### Manual
Usuario crea el lead desde dashboard.

### Formulario web
Lead ingresa mediante landing o formulario.

---

# 9. Información del Lead

## Campos iniciales

- ID único
- Nombre
- Teléfono
- Email (opcional)
- Fuente
- Referido por
- Estado actual
- Subestado
- Fecha creación
- Última actividad
- Próxima acción
- Motivo de no inversión
- Observaciones

---

# 10. ID Único

Cada lead tendrá un identificador único visible.

Ejemplo:

- #1001
- #1002
- #1003

El ID debe mostrarse:

- En cards
- En detalle del lead
- En búsquedas
- En reportes

---

# 11. Validación de Duplicados

## Regla principal

Validar duplicados por número telefónico.

## Comportamiento esperado

Si el teléfono ya existe:

Mostrar alerta:

> “Este contacto ya existe.”

Opciones:

- Ver lead existente
- Continuar creando (casos especiales)

---

# 12. Dashboard Principal

## Componentes

### Pipeline visual
Columnas por estado.

### Pendientes de hoy
Leads que requieren seguimiento.

### Métricas rápidas

- Leads del mes
- Reuniones agendadas
- Conversiones
- Leads pendientes

### Accesos rápidos

- Nuevo lead
- Buscar lead
- Ver historial

---

# 13. Cards (Tarjetas)

## Información visible

- ID
- Nombre
- Teléfono
- Estado
- Próxima acción
- Indicador visual
- Última nota

## Colores sugeridos

- Amarillo → Nuevo
- Azul → Contactado
- Naranja → Respondió
- Verde → Invirtió
- Gris → No invirtió definitivo

## Indicadores adicionales

- Rojo → Seguimiento vencido
- Verde → Al día

---

# 14. Acciones Guiadas

Cada card tendrá botones contextuales.

## Ejemplo

### Estado: Nuevo
Botón:

- Enviar mensaje

Resultado:

- Cambia a Contactado

### Estado: Contactado
Botón:

- Marcar respuesta

Resultado:

- Cambia a Respondió

### Estado: Respondió
Botón:

- Agendar reunión

Resultado:

- Cambia a Agendada

---

# 15. Integración WhatsApp

## Fase Inicial

Uso de links prellenados.

Ejemplo:

https://wa.me/506XXXXXXXX?text=Hola...

## Objetivo

Facilitar contacto rápido sin integración compleja.

---

# 16. Integración Calendly

El sistema debe permitir:

- Guardar link Calendly del usuario
- Acceso rápido desde cada lead

Futuro:

- Integración API

---

# 17. Sistema de Recordatorios

## Concepto

Leads en seguimiento deben reaparecer automáticamente según fecha definida.

## Ejemplo

Juan Pérez
No invirtió – falta liquidez

Opciones:

- Enviar mensaje
- Recordar en 30 días
- Recordar en 90 días
- No volver a recordar

---

# 18. Próxima Acción

Campo clave:

- next_action_date

## Comportamiento

Si la fecha coincide con el día actual:

- Mostrar en “Pendientes de hoy”

---

# 19. Leads Cerrados e Históricos

## Regla

Leads cerrados no permanecerán indefinidamente en pipeline principal.

## Configuración

Cada usuario podrá definir cuántos días desea visualizar cerrados recientes.

Opciones sugeridas:

- 7 días
- 15 días
- 30 días

## Después de ese período

Los leads pasan automáticamente a:

- Archivo / Historial

---

# 20. Bitácora de Actividades (Timeline)

## Concepto

Cada lead debe mantener una bitácora completa de actividades y eventos relacionados con su ciclo de vida.

La bitácora funcionará como una línea de tiempo centralizada que permitirá visualizar:

- Qué ocurrió
- Cuándo ocurrió
- Quién realizó la acción
- Qué seguimiento debe realizarse posteriormente

---

## Objetivos

- Mantener trazabilidad completa
- Evitar pérdida de contexto
- Facilitar seguimiento comercial
- Permitir continuidad entre usuarios
- Servir como base para métricas futuras

---

## Actividades automáticas

El sistema debe registrar automáticamente:

- Lead creado
- Cambio de estado
- Mensaje enviado
- Recordatorio programado
- Reunión agendada
- Lead cerrado
- Reactivación del lead

---

## Actividades manuales

El usuario podrá registrar manualmente:

- Notas
- Comentarios
- Resultado de llamada
- Observaciones
- Seguimientos personalizados

---

## Información almacenada por actividad

- Fecha y hora
- Usuario responsable
- Tipo de actividad
- Descripción
- Metadata opcional

---

## Ejemplo

07/05/2026 10:22
Lead creado por Carlos

07/05/2026 10:25
Mensaje enviado vía WhatsApp

08/05/2026 09:10
Cliente respondió interesado

08/05/2026 09:30
Reunión agendada para 10/05

10/05/2026 16:00
Cliente no invirtió - falta liquidez

10/05/2026 16:02
Recordatorio programado para 30 días

---

## Consideraciones técnicas

Se recomienda centralizar todas las actividades en una tabla tipo:

activities

Campos sugeridos:

- id
- lead_id
- user_id
- type
- description
- metadata
- created_at

---

## Tipos de actividad sugeridos

- lead_created
- status_change
- note
- whatsapp_sent
- reminder_created
- meeting_scheduled
- lead_reactivated
- lead_closed

---

## Reglas importantes

- Las actividades no deben sobrescribirse.
- La bitácora debe ser trazable.
- Eventos automáticos críticos no deben editarse manualmente.
- La bitácora debe mostrarse cronológicamente.

---

# 21. Sistema de Notas

Cada lead puede tener múltiples notas.

## Ejemplo

[01/05]
Cliente interesado pero sin liquidez.

[15/05]
Volver a contactar en junio.

## Regla

Las notas nunca se sobrescriben.

---

# 22. Tiempo sin Acción

## Objetivo

Detectar leads olvidados.

## Campo

- last_activity_at

## Comportamiento

Si un lead supera cierta cantidad de días sin actividad:

- Mostrar alerta visual

---

# 23. Usuarios y Roles

## Roles iniciales

### Admin

- Gestiona usuarios
- Configura sistema
- Accede a reportes
- Configura pipeline

### Usuario

- Gestiona leads
- Cambia estados
- Agrega notas
- Usa dashboard

---

# 24. Configuración de Pipeline

El sistema debe permitir modificar el flujo a futuro.

## Configurable

- Estados
- Orden
- Colores
- Reglas básicas

## Objetivo

Permitir adaptar el sistema para diferentes clientes.

---

# 25. Reportes Iniciales

## Conversión por etapa

Ejemplo:

- Leads totales
- Contactados
- Respondieron
- Agendaron
- Invirtieron

## Tasa de cierre

Porcentaje de inversión.

## Motivos de no inversión

- Falta de dinero
- Desconfianza
- Timing
- Otros

## Seguimiento pendiente

Leads vencidos o sin acción.

## Tiempo promedio de conversión

Tiempo desde creación hasta cierre.

---

# 26. Seguridad

## Básico inicial

- Login
- Password hashing
- Sesiones seguras
- Roles

---

# 27. Requerimientos del Cliente

Para iniciar correctamente el proyecto se requiere:

## Información necesaria

- Flujo comercial definitivo
- Mensajes utilizados actualmente
- Link Calendly
- Definición de seguimiento
- Colores y branding
- Usuarios iniciales

---

# 28. Posibles Mejoras Futuras

## Fase 2

- WhatsApp Business API
- Automatización real de mensajes
- Email automático
- Dashboard avanzado
- Métricas inteligentes
- Asignación de leads
- Multiusuario avanzado
- Pipeline múltiple

---

# 29. Conclusión

El sistema busca resolver un problema específico:

- Falta de seguimiento
- Pérdida de oportunidades
- Gestión manual de prospectos

La solución propuesta permitirá:

- Centralizar leads
- Guiar el proceso comercial
- Mejorar seguimiento
- Medir conversiones
- Organizar el pipeline comercial

Todo esto manteniendo una primera versión simple, escalable y enfocada en resultados.

