import qrcode from "qrcode";
import invariant from "tiny-invariant";
import db from "../db.server";

/**
 * Create a function to get a single QR code for your QR code form for you app's index page.
 * QR codes stored in the database can be retrieved using the Prisma FindFirst and FindMany queries.
 * This function is used to visualize the qr codes in the app index page.
 * @param {*} id 
 * @param {*} graphql 
 * @returns 
 */
export async function getQRCode(id, graphql) {
    const qrCode = await db.qRCode.findFirst({ where: { id } });

    if (!qrCode) {
        return null;
    }

    return supplementQRCode(qrCode, graphql);
}

/**
 * Create a function to get multiple QR codes for your app's index page
 * QR codes stored in the database can be retrieved using the Prisma FindFirst and FindMany queries.
 * This function is used to visualize the qr codes in the app index page.
 * @param {*} shop 
 * @param {*} graphql 
 * @returns 
 */
export async function getQRCodes(shop, graphql) {
    const qrCodes = await db.qRCode.findMany({
        where: { shop },
        orderBy: { id: "desc" },
    });

    if (qrCodes.length === 0) return [];

    return Promise.all(
        qrCodes.map((qrCode) => supplementQRCode(qrCode, graphql))
    );
}

/**
 * A QR code takes the user to /qrcodes/$id/scan, where $id is the ID of the QR code. 
 * Create a function to construct this URL, and then use the qrcode package to return a base 64-encoded QR code image src.
 * @param {*} id - id of the qr code
 * @returns data uri representation of the qr code image
 */
export function getQRCodeImage(id) {
    const url = new URL(`/qrcodes/${id}/scan`, process.env.SHOPIFY_APP_URL);
    return qrcode.toDataURL(url.href);
}

/**
 * Create a function to conditionally construct this URL depending on the destination that the merchant selects.
 * 
 * Scanning a QR code takes the user to one of two places:
 *      The product details page
 *      A checkout with the product in the cart
 * 
 * @param {*} qrCode - qrcode with destination embedded
 * @returns a different url depending on the destination
 */
export function getDestinationUrl(qrCode) {
    if (qrCode.destination === "product") {
        return `https://${qrCode.shop}/products/${qrCode.productHandle}`;
    }

    const match = /gid:\/\/shopify\/ProductVariant\/([0-9]+)/.exec(qrCode.productVariantId);
    invariant(match, "Unrecognized product variant ID");

    return `https://${qrCode.shop}/cart/${match[1]}:1`;
}

/**
 * Create a function that queries the Shopify Admin GraphQL API for the:
 *      product title, 
 *      the first featured product image's URL
 *      alt text. 
 * 
 * It should also return an object with the: 
 *      QR code data  
 *      product data
 *      get the destination URL's QR code image.
 * 
 * Retrieve additional product and variant data
 * The QR code from Prisma needs to be supplemented with product data. It also needs the QR code image and destination URL.
 * 
 * @param {*} qrCode - qr code found in the db
 * @param {*} graphql - db api
 * @returns - an augmented object with data about the qr code and the product it refers to
 */
async function supplementQRCode(qrCode, graphql) {
    const qrCodeImagePromise = getQRCodeImage(qrCode.id);

    const response = await graphql(
        `
      query supplementQRCode($id: ID!) {
        product(id: $id) {
          title
          images(first: 1) {
            nodes {
              altText
              url
            }
          }
        }
      }
    `,
        {
            variables: {
                id: qrCode.productId,
            },
        }
    );

    const {
        data: { product },
    } = await response.json();

    return {
        ...qrCode,
        productDeleted: !product?.title,
        productTitle: product?.title,
        productImage: product?.images?.nodes[0]?.url,
        productAlt: product?.images?.nodes[0]?.altText,
        destinationUrl: getDestinationUrl(qrCode),
        image: await qrCodeImagePromise,
    };
}

/**
 * To create a valid QR code, the app user needs to provide a title, and select a product and destination.
 * This function ensures that, when the user submits the form to create a QR code, values exist for all of the required fields.
 * The action for the QR code form will return errors from this function.
 * @param {*} data - the data that will be turned into a qr code
 * @returns - errors if any are found and the qr data is not valid
 */
export function validateQRCode(data) {
    const errors = {};

    if (!data.title) {
        errors.title = "Title is required";
    }

    if (!data.productId) {
        errors.productId = "Product is required";
    }

    if (!data.destination) {
        errors.destination = "Destination is required";
    }

    if (Object.keys(errors).length) {
        return errors;
    }
}
