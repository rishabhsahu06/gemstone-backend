import twilio from "twilio"
import config from "../config/config.js"

// Initialize Twilio client
const client = twilio(config.whatsapp.accountSid, config.whatsapp.authToken)

/**
 * Send WhatsApp message using Twilio
 * @param {string} to - Recipient phone number with country code
 * @param {string} message - Message content
 * @returns {Promise} - Twilio message response
 */
export const sendWhatsAppMessage = async (to, message) => {
  try {
    const response = await client.messages.create({
      body: message,
      from: `whatsapp:${config.whatsapp.phoneNumber}`,
      to: `whatsapp:${to}`,
    })

    console.log(`WhatsApp message sent with SID: ${response.sid}`)
    return response
  } catch (error) {
    console.error("Error sending WhatsApp message:", error)
    throw error
  }
}
