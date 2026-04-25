# chatbot-whatsapp-business-caceres-casio

Sistema funcional en Node.js para WhatsApp Business Cloud API que:

- calcula riesgo economico basico
- captura datos
- filtra prospectos
- guarda respuestas en JSON
- marca leads calificados
- prepara seguimiento humano

## Estructura

```text
chatbot-whatsapp-business-caceres-casio/
  src/
    flows/
    services/
    utils/
    data/
  config/
  docs/
  .env.example
  package.json
  index.js
  README.md
```

## Instalacion

1. Instalar Node.js 18 o superior.
2. Entrar al proyecto:

```bash
cd chatbot-whatsapp-business-caceres-casio
```

3. Crear archivo `.env` a partir de `.env.example`.
4. Ajustar variables de entorno.
5. Ejecutar:

```bash
npm start
```

## Ejecucion

El servicio levanta un servidor HTTP con:

- `GET /health` estado del sistema
- `GET /webhook` verificacion de Meta
- `POST /webhook` recepcion de mensajes de WhatsApp
- `GET /leads` consulta local de leads guardados
- `GET /sessions` consulta local de sesiones guardadas

## Conexion WhatsApp Business

1. Crear una app en Meta for Developers.
2. Activar WhatsApp Business Cloud API.
3. Obtener:

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `META_VERIFY_TOKEN`

4. Configurar el webhook en Meta con:

- URL: `https://tu-dominio-publico.com/webhook`
- Verify token: mismo valor de `META_VERIFY_TOKEN`

5. Suscribir el campo `messages`.
6. Asegurar que tu servidor sea accesible por HTTPS.

Guia operativa adicional: [docs/whatsapp-business-setup.md](/C:/Users/Franklin/Documents/Diagnostico-Riesgo/chatbot-whatsapp-business-caceres-casio/docs/whatsapp-business-setup.md)

## Configuracion .env

Variables disponibles:

- `PORT`: puerto local del servidor
- `APP_BASE_URL`: URL publica del servicio
- `META_VERIFY_TOKEN`: token de verificacion del webhook
- `WHATSAPP_ACCESS_TOKEN`: token de acceso Cloud API
- `WHATSAPP_PHONE_NUMBER_ID`: identificador del numero
- `WHATSAPP_API_VERSION`: version de la API de Meta
- `DEFAULT_COST_PER_M2`: costo base configurable por m2
- `CONCRETE_MULTIPLIER`: ajuste para construccion de concreto
- `MIXED_MULTIPLIER`: ajuste para construccion mixta
- `LIGHT_MULTIPLIER`: ajuste para construccion ligera
- `PLUS_SQUARE_METERS_FALLBACK`: valor usado cuando el usuario responde `+`

## Modificacion de costos

Se puede modificar por variables de entorno o por archivo de configuracion:

- Variables: `.env`
- Archivo: [config/default.js](/C:/Users/Franklin/Documents/Diagnostico-Riesgo/chatbot-whatsapp-business-caceres-casio/config/default.js)

Reglas actuales:

- costo base por m2 configurable
- rango referencial mostrado: `10,000 - 18,000 MXN por m2`
- multiplicador por tipo de construccion

Formula aplicada:

```text
valor = m2 x costo_base x multiplicador_material
```

## Acceso a leads

Los leads se guardan en JSON:

- [src/data/leads.json](/C:/Users/Franklin/Documents/Diagnostico-Riesgo/chatbot-whatsapp-business-caceres-casio/src/data/leads.json)
- [src/data/sessions.json](/C:/Users/Franklin/Documents/Diagnostico-Riesgo/chatbot-whatsapp-business-caceres-casio/src/data/sessions.json)

Tambien se puede consultar por HTTP local:

- `GET /leads`
- `GET /sessions`

Cuando un usuario escribe `ANALIZAR`:

- se guarda el historial de respuestas
- se marca `isQualifiedLead: true`
- se registra `requiresHumanFollowUp: true`
- se genera resumen operativo para seguimiento humano

## Flujo operativo

1. Mensaje inicial obligatorio.
2. Captura de ubicacion.
3. Captura de metros cuadrados.
4. Captura de tipo de construccion.
5. Calculo de riesgo economico estimado.
6. Respuesta con monto y exclusiones.
7. Mensaje final con `ANALIZAR`.
8. Si el usuario responde `ANALIZAR`, se califica como lead.
