import { json } from "@remix-run/node";
import invariant from "tiny-invariant";
import { useLoaderData } from "@remix-run/react";

import db from "../db.server";
import { getQRCodeImage } from "~/models/QRCode.server";

/**
 * Create a loader to load the QR code on the external route.
 * 
 * @param {*} param0 
 * @returns 
 */
export const loader = async ({ params }) => {
    //In the function, check that there's an ID in the URL. If there isn't, throw an error using tiny-invariant.
    invariant(params.id, "Could not find QR code destination");

    //If there's an ID in the URL, load the QR code with that ID using Prisma:
    const id = Number(params.id);
    const qrCode = await db.qRCode.findFirst({ where: { id } });

    //If there is no matching QR code ID in the table, throw an error using tiny-invariant.
    invariant(qrCode, "Could not find QR code destination");

    //If there is a matching ID, return the QR code using a Remix json function.
    return json({
        title: qrCode.title,
        image: await getQRCodeImage(id),
    });
};

/**
 * Render a public QR code image
 * @returns 
 */
export default function QRCode() {
    const { image, title } = useLoaderData();

    return (
        <>
            <h1>{title}</h1>
            <img src={image} alt={`QR Code for product`} />
        </>
    );
}
