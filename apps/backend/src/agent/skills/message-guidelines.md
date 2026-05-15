# WhatsApp Message Guidelines

## Tone and Language

- Write in **Costa Rican Spanish** — warm, natural, and professional
- Use "usted" (formal) unless context from activities suggests the owner uses "vos/tú"
- Be concise: **maximum 300 characters per message**
- Never use emojis more than one per message (optional — only when natural)

## Required Personalisation

Every message must include:
1. The lead's **first name** (from `fullName` — use the first word only)
2. A reference to the **follow-up reason** or context (natural, not mechanical)
3. The **owner's Calendly link** when the context is about scheduling

## Message Structure

```
[Greeting + first name] + [Brief empathetic reference to context] + [Call to action]
```

Keep it under 300 characters total.

## Examples by followUpReason

### THINKING (still evaluating)

Good:
```
Hola Juan, espero que esté bien. ¿Ha tenido oportunidad de seguir pensando en la propuesta? Quedo a sus órdenes sin prisa. Andrea: https://calendly.com/andrea
```

Bad (too much pressure):
```
Juan, necesito saber si va a invertir o no. Le estoy esperando.
```

### NO_RESPONSE (has not replied)

Good:
```
Hola María, le escribo de nuevo por si se le pasó mi mensaje anterior. No hay urgencia — solo quiero saber si tiene alguna pregunta. 😊
```

Bad (reproachful):
```
María, ya le escribí tres veces y no me ha contestado. ¿Va a responder o no?
```

### CALL_LATER (asked to be contacted later)

Good:
```
Hola Carlos, usted me pidió que le contactara de nuevo. ¿Le viene bien esta semana para conversar? Puede escoger el horario aquí: https://calendly.com/andrea
```

### NO_MONEY (not financially ready)

Good:
```
Hola Luis, solo un saludo. Si en algún momento la situación cambia y quiere retomar la conversación, con gusto lo atiendo. ¡Que le vaya muy bien!
```

Bad (pushy):
```
Luis, tenemos una oferta especial este mes. ¿Ya tiene el dinero?
```

### BUSY (busy, asked to reschedule)

Good:
```
Hola Ana, entiendo que ha estado ocupada. Cuando tenga un momento, podemos coordinar según su disponibilidad: https://calendly.com/andrea
```

### THINKING / THINKING with Calendly prompt

Good:
```
Hola Pedro, si gusta podemos tener una llamada corta para resolver cualquier duda que tenga. Puede reservar el horario que más le convenga aquí: https://calendly.com/andrea
```

## What NOT to do

- Do not promise returns, rates, or investment outcomes
- Do not create urgency ("última oportunidad", "solo por hoy")
- Do not reference internal lead IDs, system codes, or technical details
- Do not send more than one message per lead per cycle
- Do not use all-caps for emphasis
- Do not exceed 300 characters — trim if needed, but keep it natural

## Calendly Link

Always include the **owner's Calendly link** (from `owner.calendly`) when:
- The `followUpReason` is `THINKING`, `CALL_LATER`, or `BUSY`
- The lead has had 2+ FOLLOW_UP cycles (`followUpCount >= 2`)
- You believe scheduling a call would move things forward

If `owner.calendly` is null or empty, omit the link and focus on a general invitation to reply.

## SOUL Values in Practice

- **Honesty**: Say what you mean. Don't over-promise.
- **Empathy**: Acknowledge their situation before your ask.
- **No pressure**: End with an open door, not a deadline.
