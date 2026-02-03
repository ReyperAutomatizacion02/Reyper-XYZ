/**
 * Sistema de logging centralizado para Reyper XYZ
 * 
 * En desarrollo: muestra todos los logs en consola
 * En producción: solo muestra errores críticos y los envía a un servicio de monitoreo
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isDevelopment = process.env.NODE_ENV === 'development';

class Logger {
    private log(level: LogLevel, message: string, data?: any) {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

        // En desarrollo, mostrar todos los logs
        if (isDevelopment) {
            switch (level) {
                case 'debug':
                    console.log(prefix, message, data || '');
                    break;
                case 'info':
                    console.info(prefix, message, data || '');
                    break;
                case 'warn':
                    console.warn(prefix, message, data || '');
                    break;
                case 'error':
                    console.error(prefix, message, data || '');
                    break;
            }
            return;
        }

        // En producción, solo errores críticos
        if (level === 'error') {
            console.error(prefix, message, data || '');

            // TODO: Aquí puedes integrar un servicio de monitoreo como Sentry
            // Sentry.captureException(new Error(message), { extra: data });
        }
    }

    debug(message: string, data?: any) {
        this.log('debug', message, data);
    }

    info(message: string, data?: any) {
        this.log('info', message, data);
    }

    warn(message: string, data?: any) {
        this.log('warn', message, data);
    }

    error(message: string, error?: any) {
        this.log('error', message, error);
    }
}

// Exportar instancia singleton
export const logger = new Logger();

// Exportar también como default para imports más simples
export default logger;
