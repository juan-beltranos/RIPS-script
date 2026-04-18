const fs = require("fs");
const path = require("path");

// === CONFIGURA AQUÍ LA RUTA RAÍZ ===
// Cambia esta ruta por la carpeta principal: "RIPS ENE MARZO"
const ROOT_DIR = "C:/Users/Developer/Desktop/RIPS ENE MARZO";

// Meses a procesar
const MONTHS = ["ENERO", "FEBRERO", "MARZO"];

// Si quieres probar sin mover realmente los archivos, cambia a true
const DRY_RUN = false;

/**
 * Extrae el número del archivo JSON.
 * Ej: FE469.json -> 469
 */
function getNumberFromJsonFile(fileName) {
    const match = fileName.match(/^FE(\d+)\.json$/i);
    return match ? match[1] : null;
}

/**
 * Mueve un archivo, incluso entre discos distintos.
 */
function moveFile(source, destination) {
    try {
        fs.renameSync(source, destination);
    } catch (error) {
        if (error.code === "EXDEV") {
            fs.copyFileSync(source, destination);
            fs.unlinkSync(source);
        } else {
            throw error;
        }
    }
}

function main() {
    let movedCount = 0;
    let notFoundCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const month of MONTHS) {
        const jsonMonthDir = path.join(ROOT_DIR, "json", month);
        const targetMonthDir = path.join(ROOT_DIR, month);

        if (!fs.existsSync(jsonMonthDir)) {
            console.warn(`No existe la carpeta de JSON del mes: ${jsonMonthDir}`);
            continue;
        }

        if (!fs.existsSync(targetMonthDir)) {
            console.warn(`No existe la carpeta destino del mes: ${targetMonthDir}`);
            continue;
        }

        const files = fs.readdirSync(jsonMonthDir);

        for (const file of files) {
            const sourcePath = path.join(jsonMonthDir, file);

            if (!fs.statSync(sourcePath).isFile()) {
                continue;
            }

            const docNumber = getNumberFromJsonFile(file);

            if (!docNumber) {
                console.log(`Omitido (nombre no válido): ${sourcePath}`);
                skippedCount++;
                continue;
            }

            const casFolderName = `CAS${docNumber}`;
            const casFolderPath = path.join(targetMonthDir, casFolderName);

            if (!fs.existsSync(casFolderPath) || !fs.statSync(casFolderPath).isDirectory()) {
                console.log(`No se encontró carpeta destino para ${file}: ${casFolderPath}`);
                notFoundCount++;
                continue;
            }

            const destinationPath = path.join(casFolderPath, file);

            if (fs.existsSync(destinationPath)) {
                console.log(`Ya existe el archivo destino, se omite: ${destinationPath}`);
                skippedCount++;
                continue;
            }

            try {
                if (DRY_RUN) {
                    console.log(`[DRY RUN] Mover: ${sourcePath} -> ${destinationPath}`);
                } else {
                    moveFile(sourcePath, destinationPath);
                    console.log(`Movido: ${sourcePath} -> ${destinationPath}`);
                }
                movedCount++;
            } catch (error) {
                console.error(`Error moviendo ${sourcePath}: ${error.message}`);
                errorCount++;
            }
        }
    }

    console.log("\n=== RESUMEN ===");
    console.log(`Movidos: ${movedCount}`);
    console.log(`Sin carpeta destino: ${notFoundCount}`);
    console.log(`Omitidos: ${skippedCount}`);
    console.log(`Errores: ${errorCount}`);
}

main();