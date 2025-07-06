// netlify/functions/submit-assessment.js

const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

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
            individual_scores
        } = payload;

        const submissionId = uuidv4();
        const timestamp = new Date().toISOString(); 

        // 1. Send data to HubSpot
        const hubspotAccessToken = process.env.HUBSPOT_ACCESS_TOKEN; // <<< UPDATED variable name >>>

        if (!hubspotAccessToken) { // Simplified check for presence
            console.warn("HubSpot Access Token not configured. Skipping HubSpot submission.");
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
                    'individual_assessment_scores': JSON.stringify(individual_scores),
                }
            };

            try {
                const hsResponse = await fetch(hubspotUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${hubspotAccessToken}` // <<< UPDATED Authorization Header >>>
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

        // Return success response to the client
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
