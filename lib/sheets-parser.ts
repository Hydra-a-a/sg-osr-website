import { ZodSchema } from 'zod';

export interface ColumnMapping {
    /** The index in the Google Sheets row (0-indexed) */
    index: number;
    /** The key in the resulting JSON object */
    key: string;
    /** Default value if the column is undefined or empty string */
    defaultValue?: any;
    /** Optional transformation function before Zod validation */
    transform?: (value: any) => any;
}

export interface ParseOptions<T> {
    /** The raw rows returned from Google Sheets API */
    rows: any[][];
    /** Configuration mapping column indices to object keys */
    mapping: ColumnMapping[];
    /** Zod schema to validate the constructed object */
    schema: ZodSchema<T>;
    /** Starting row index to parse (default: 0) */
    startRow?: number;
    /** If true, skips rows that fail validation instead of throwing (default: true) */
    skipInvalid?: boolean;
    /** Optional callback to log validation errors */
    onError?: (error: any, rowNumber: number) => void;
}

/**
 * Generic utility to parse and validate raw Google Sheets data into typed objects.
 */
export function parseSheetData<T>({
    rows,
    mapping,
    schema,
    startRow = 0,
    skipInvalid = true,
    onError
}: ParseOptions<T>): { validData: T[], invalidCount: number } {

    if (!rows || rows.length === 0) {
        return { validData: [], invalidCount: 0 };
    }

    const validData: T[] = [];
    let invalidCount = 0;

    for (let i = startRow; i < rows.length; i++) {
        const row = rows[i];
        const rowData: Record<string, any> = {};

        // To handle sheets that shift, we might need to find the first non-empty cell if requested
        // For now, adhere strictly to the mapping.

        // Build the object based on the mapping
        for (const col of mapping) {
            let value = row[col.index];

            // Handle empty strings as undefined to let Zod handle defaults/optionals if needed,
            // or apply the user-defined default.
            if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
                value = col.defaultValue;
            }

            if (col.transform && value !== undefined) {
                value = col.transform(value);
            }

            rowData[col.key] = value;
        }

        // Validate with Zod
        const result = schema.safeParse(rowData);

        if (result.success) {
            validData.push(result.data);
        } else {
            invalidCount++;
            if (onError) {
                onError(result.error.format(), i + 2); // +2 assuming row 0 is header and array is 0-indexed
            }
            if (!skipInvalid) {
                throw new Error(`Validation failed for row ${i + 2}: ${JSON.stringify(result.error.format())}`);
            }
        }
    }

    return { validData, invalidCount };
}
