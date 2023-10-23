import { json } from "@remix-run/node";
import { useLoaderData, Link, useNavigate } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import {
  Card,
  EmptyState,
  Layout,
  Page,
  IndexTable,
  Thumbnail,
  Text,
  Icon,
  HorizontalStack,
} from "@shopify/polaris";

import { getQRCodes } from "../models/QRCode.server";
import { DiamondAlertMajor, ImageMajor } from "@shopify/polaris-icons";

/**
 * This function is only ever run on the server.
 * This is a convenient way to do server-ish things that the client can’t be trusted with — auth, connecting to a db etc.
 * @param {*} param0 
 * @returns 
 */
export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);
  const qrCodes = await getQRCodes(session.shop, admin.graphql);

  return json({
    qrCodes,
  });
}

/**
 * If there are no QR codes, use EmptyState to present a call to action to create QR codes.
 * @param {*} param0 
 * @returns 
 */
const EmptyQRCodeState = ({ onAction }) => (
  <EmptyState
    heading="Create unique QR codes for your product"
    action={{
      content: "Create QR code",
      onAction,
    }}
    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
  >
    <p>Allow customers to scan codes and buy products using their phones.</p>
  </EmptyState>
);

function truncate(str, { length = 25 } = {}) {
  if (!str) return "";
  if (str.length <= length) return str;
  return str.slice(0, length) + "…";
}

/**
 * If there are QR codes present, then use the Polaris IndexTable component to list them.
 * 
 * @param {*} param0 
 * @returns 
 */
const QRTable = ({ qrCodes }) => (
  <IndexTable
    resourceName={{
      singular: "QR code",
      plural: "QR codes",
    }}
    itemCount={qrCodes.length}
    headings={[
      { title: "Thumbnail", hidden: true },
      { title: "Title" },
      { title: "Product" },
      { title: "Date created" },
      { title: "Scans" },
    ]}
    selectable={false}
  >
    {qrCodes.map((qrCode) => (
      <QRTableRow key={qrCode.id} qrCode={qrCode} />
    ))}
  </IndexTable>
);

/**
 * Map over each QR code and render an IndexTable.
 * Row that uses Polaris components to structure the row and render QR code information.
 * @param {*} param0 
 * @returns 
 */
const QRTableRow = ({ qrCode }) => (
  <IndexTable.Row id={qrCode.id} position={qrCode.id}>
    <IndexTable.Cell>
      <Thumbnail
        source={qrCode.productImage || ImageMajor}
        alt={qrCode.productTitle}
        size="small"
      />
    </IndexTable.Cell>
    <IndexTable.Cell>
      <Link to={`qrcodes/${qrCode.id}`}>{truncate(qrCode.title)}</Link>
    </IndexTable.Cell>
    <IndexTable.Cell>

      {/* Warn if a product is deleted */}
      {qrCode.productDeleted ? (
        <HorizontalStack align="start" gap="2">
          <span style={{ width: "20px" }}>
            <Icon source={DiamondAlertMajor} color="critical" />
          </span>
          <Text color="critical" as="span">
            product has been deleted
          </Text>
        </HorizontalStack>
      ) : (
        truncate(qrCode.productTitle)
      )}
      
    </IndexTable.Cell>
    <IndexTable.Cell>
      {new Date(qrCode.createdAt).toDateString()}
    </IndexTable.Cell>
    <IndexTable.Cell>{qrCode.scans}</IndexTable.Cell>
  </IndexTable.Row>
);

/**
 * Create a layout using Polaris components. Render the empty state and table inside a Polaris Card.
 * @returns 
 */
export default function Index() {
  const { qrCodes } = useLoaderData();
  const navigate = useNavigate();

  return (
    <Page>

      {/* Use the App Bridge ui-title-bar to render the title bar with a title. 
      Add a primary button to navigate to the QR code creation form. */}
      <ui-title-bar title="QR codes">
        <button variant="primary" onClick={() => navigate("/app/qrcodes/new")}>
          Create QR code
        </button>
      </ui-title-bar>

      <Layout>
        <Layout.Section>
          <Card padding="0">
            {qrCodes.length === 0 ? (
              <EmptyQRCodeState onAction={() => navigate("qrcodes/new")} />
            ) : (
              <QRTable qrCodes={qrCodes} />
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
