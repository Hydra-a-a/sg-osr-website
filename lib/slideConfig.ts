import { getSlidesData, SlideData } from './google';
import { redactErrorForLog } from './security';

export interface SiteConfig {
    maintenanceMode: boolean;
    electionsActive: boolean;
    alertBanner?: string;
    // add more toggles later when they ask for more stuff
}

// default config just in case it breaks
const DEFAULT_CONFIG: SiteConfig = {
    maintenanceMode: false,
    electionsActive: false,
};

/**
 * parses the ugly google slide config page so we don't need a real database
 */
export async function getSiteConfig(): Promise<SiteConfig> {
    try {
        const slides = await getSlidesData();
        const config = { ...DEFAULT_CONFIG };

        for (const slide of slides) {
            let isConfigSlide = false;
            let slideText = '';

            // smash all text together
            slide.pageElements?.forEach(element => {
                element.shape?.text?.textElements?.forEach(t => {
                    const content = t.textRun?.content?.trim();
                    if (content) {
                        slideText += content + '\n';
                    }
                });
            });

            // find the ONE config slide
            if (slideText.startsWith('CONFIG:')) {
                isConfigSlide = true;

                // read the booleans
                const lines = slideText.split('\n');
                for (const line of lines) {
                    const cleanLine = line.trim().toUpperCase();

                    if (cleanLine.includes('MAINTENANCE_MODE: TRUE')) {
                        config.maintenanceMode = true;
                    }
                    if (cleanLine.includes('ELECTIONS_ACTIVE: TRUE')) {
                        config.electionsActive = true;
                    }
                    if (cleanLine.startsWith('ALERT_BANNER:')) {
                        config.alertBanner = line.split(':')[1]?.trim();
                    }
                }

                // got what we needed, bail out
                break;
            }
        }

        return config;

    } catch (error) {
        console.error("Failed to fetch Site Config, failing open to DEFAULT_CONFIG", redactErrorForLog(error));
        return DEFAULT_CONFIG;
    }
}
