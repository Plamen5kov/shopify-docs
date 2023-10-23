import { redirect } from "@remix-run/node";
import invariant from "tiny-invariant";
import db from "../db.server";

import { getDestinationUrl } from "../models/QRCode.server";

/**
 * This is executed when someone has scanned the qr code. It's a simple iterate and redirect
 * Loader function to load the QR code from the database.
 * @param {*} param0 
 * @returns 
 */
export const loader = async ({ params }) => {
    //check there is an ID in the URL. If the ID isn't present, then throw an error using tiny-invariant.
    invariant(params.id, "Could not find QR code destination");

    //Load the QR code from the Prisma database. 
    const id = Number(params.id);
    const qrCode = await db.qRCode.findFirst({ where: { id } });

    //If a QR code with the specified ID doesn't exist, then throw an error using tiny-invariant.
    invariant(qrCode, "Could not find QR code destination");

    //If the loader returns a QR code, then increment the scan count in the database.
    await db.qRCode.update({
        where: { id },
        data: { scans: { increment: 1 } },
    });

    //Redirect to the destination URL for the QR code using getDestinationUrl and the Remix redirect utility.
    return redirect(getDestinationUrl(qrCode));
};
