// netlify/functions/submit-assessment.js

const fetch = require('node-fetch'); // Required for making HTTP requests
const { v4: uuidv4 } = require('uuid'); // For generating unique IDs

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const payload = JSON.parse(event.body);

        const {
            firstname,
            lastname,
            email,
            company,
            company_website,
            linkedin_profile,
            ascent_score,
            strategic_score,
            operational_score,
            leadership_score,
            individual_scores // This is an object like {q1: 3, q2: 4, ...}
        } = payload;

        // Although not used for Google Sheet anymore, submissionId and timestamp can be useful for other logs or future integrations
        const submissionId = uuidv4();
        const timestamp = new Date().toISOString(); 

        // 1. Send data to HubSpot
        const hubspotApiKey = process.env.HUBSPOT_API_KEY;
        const hubspotPortalId = process.env.HUBSPOT_PORTAL_ID; // Note: HubSpot API Key is generally sufficient for modern APIs

        if (!hubspotApiKey || hubspotApiKey.includes('YOUR_HUBSPOT_API_KEY')) {
            console.warn("HubSpot API Key not configured. Skipping HubSpot submission.");
        } else {
            const hubspotUrl = `https://api.hubapi.com/crm/v3/objects/contacts`;
            const hsPayload = {
                properties: {
                    firstname: firstname,
                    lastname: lastname,
                    email: email,
                    company: company,
                    website: company_website,
                    ascent_score: ascent_score,
                    strategic_score: strategic_score,
                    operational_score: operational_score,
                    leadership_score: leadership_score,
                    // === UPDATED: Using 'individual_assessment_scores' as the internal name ===
                    'individual_assessment_scores': JSON.stringify(individual_scores),
                    // =========================================================================
                }
            };

            try {
                const hsResponse = await fetch(hubspotUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${hubspotApiKey}`
                    },
                    body: JSON.stringify(hsPayload)
                });

                if (!hsResponse.ok) {
                    const errorData = await hsResponse.json();
                    console.error('HubSpot API Error:', errorData);
                    throw new Error('Failed to send data to HubSpot.');
                }
                console.log('Data sent to HubSpot successfully.');
            } catch (error) {
                console.error('Error sending data to HubSpot:', error);
                throw error;
            }
        }

        // 2. Send data to ConvertKit
        const convertKitApiKey = process.env.CONVERTKIT_API_KEY;
        const convertKitFormId = process.env.CONVERTKIT_FORM_ID;
        const convertKitTagId = process.env.CONVERTKIT_TAG_ID;

        if (!convertKitApiKey || !convertKitFormId || !convertKitTagId || convertKitApiKey.includes('YOUR_CONVERTKIT_API_KEY')) {
            console.warn("ConvertKit API Key, Form ID, or Tag ID not configured. Skipping ConvertKit submission.");
        } else {
            const convertKitPayload = {
                api_key: convertKitApiKey,
                email: email,
                first_name: firstname,
                fields: {
                    ascent_score: ascent_score,
                    strategic_score: strategic_score,
                    operational_score: operational_score,
                    leadership_score: leadership_score,
                    // Optional: If ConvertKit also needs individual scores, you could add them here
                    // 'individual_scores_json': JSON.stringify(individual_scores)
                },
                tags: [convertKitTagId]
            };

            const convertKitResponse = await fetch(`https://api.convertkit.com/v3/forms/${convertKitFormId}/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(convertKitPayload)
            });

            if (!convertKitResponse.ok) {
                console.error('ConvertKit API Error:', await convertKitResponse.json());
                throw new Error('Failed to send data to ConvertKit.');
            }
            console.log('Data sent to ConvertKit successfully.');
        }

        // Return success response to the client (your index.html)
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Assessment data submitted successfully!' }),
        };

    } catch (error) {
        console.error('Serverless function execution error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to process assessment data.', details: error.message }),
        };
    }
};
