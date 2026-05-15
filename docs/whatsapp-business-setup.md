# Conexion operativa con WhatsApp Business Cloud API

## 1. Requisitos

- Cuenta de Meta Business
- App en Meta for Developers
- Numero habilitado en WhatsApp Business Cloud API
- Dominio publico con HTTPS para webhook

## 2. Variables necesarias

Configurar en `.env`:

```env
VERIFY_TOKEN=<your_verify_token>
WHATSAPP_TOKEN=<your_whatsapp_token>
WHATSAPP_PHONE_NUMBER_ID=<your_phone_number_id>
WHATSAPP_API_VERSION=v21.0
APP_BASE_URL=<your_private_url>
```

`DATA_DIR` es configuracion operativa para archivos runtime, no es un secreto.
No colocar tokens ni credenciales ahi, y no subir archivos runtime al repositorio.

## 3. Webhook

URL a registrar:

```text
<your_private_url>
```

Metodo de verificacion:

- Meta enviara `hub.mode`, `hub.verify_token` y `hub.challenge`
- El sistema responde el `hub.challenge` cuando el token coincide

## 4. Endpoint de recepcion

El sistema acepta mensajes entrantes en:

```text
POST /webhook
```

Procesa:

- mensajes de texto
- identificacion del remitente
- continuacion de sesion
- guardado de respuestas
- calificacion de lead

## 5. Salida a humano

Cuando el usuario escribe `ANALIZAR`:

- se genera lead calificado
- se conserva resumen del caso
- queda listo para integracion con CRM o seguimiento manual

## 6. Prueba operativa

1. Iniciar servidor.
2. Exponerlo por HTTPS.
3. Verificar webhook en Meta.
4. Enviar mensaje desde un numero habilitado.
5. Confirmar guardado en `src/data/sessions.json` y `src/data/leads.json`.
