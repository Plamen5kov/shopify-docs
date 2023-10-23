/**This route uses a dynamic segment to match the URL for creating a new QR code and editing an existing one.
 * https://remix.run/docs/en/main/discussion/routes#dynamic-segments
 */
import { useState } from "react";
import { json, redirect } from "@remix-run/node";
import {
    useActionData,
    useLoaderData,
    useNavigation,
    useSubmit,
    useNavigate,
} from "@remix-run/react";
import { authenticate } from "../shopify.server";
import {
    Card,
    Bleed,
    Button,
    ChoiceList,
    Divider,
    EmptyState,
    HorizontalStack,
    InlineError,
    Layout,
    Page,
    Text,
    TextField,
    Thumbnail,
    VerticalStack,
    PageActions,
} from "@shopify/polaris";
import { ImageMajor } from "@shopify/polaris-icons";

import db from "../db.server";
import { getQRCode, validateQRCode } from "../models/QRCode.server";

/**
 * This function is only ever run on the server.
 * This is a convenient way to do server-ish things that the client can’t be trusted with — auth, connecting to a db etc.
 * @param {{ request, params }} - request: https://remix.run/docs/en/main/route/loader#request params: https://remix.run/docs/en/main/route/loader#params
 * @returns qr code json file data depending on existing or new
 */
export async function loader({ request, params }) {
    // You can use the authenticate.admin method for the following purposes:
    //      Getting information from the session, such as the shop
    //      Accessing the Admin GraphQL API or REST API. <---- this is done here
    //      Within methods to require and request billing.
    const { admin } = await authenticate.admin(request);

    if (params.id === "new") {
        return json({
            destination: "product",
            title: "",
        });
    }

    return json(await getQRCode(Number(params.id), admin.graphql));
}

/**
 * This function is only ever run on the server.
 * Create an action to create, update, or delete a QR code.
 * The action should use the store from the session. This ensures that the app user can only create, update, or delete QR codes for their own store.
 * The action should return errors for incomplete data using your validateQRCode function.
 * If the action deletes a QR code, redirect the app user to the index page. If the action creates a QR code, redirect to app/qrcodes/$id, where $id is the ID of the newly created QR code.
 * @param {*} param0 
 * @returns 
 */
export async function action({ request, params }) {
    const { session } = await authenticate.admin(request);
    const { shop } = session;

    /** @type {any} */
    const data = {
        ...Object.fromEntries(await request.formData()),
        shop,
    };

    if (data.action === "delete") {
        await db.qRCode.delete({ where: { id: Number(params.id) } });
        return redirect("/app");
    }

    const errors = validateQRCode(data);

    if (errors) {
        return json({ errors }, { status: 422 });
    }

    const qrCode =
        params.id === "new"
            ? await db.qRCode.create({ data })
            : await db.qRCode.update({ where: { id: Number(params.id) }, data });

    return redirect(`/app/qrcodes/${qrCode.id}`);
}

export default function QRCodeForm() {
    /**
     * If the app user doesn't fill all of the QR code form fields, then the action returns errors to display. 
     * This is the return value of validateQRCode, which is accessed through the Remix useActionData hook.
     */
    const errors = useActionData()?.errors || {};

    /**
     * Returns the JSON parsed data from the current route's `loader`.
     */
    const qrCode = useLoaderData();

    /**
     * When the user changes the title, selects a product, or changes the destination, this state is updated. 
     * This state is copied from useLoaderData into React state.
     */
    const [formState, setFormState] = useState(qrCode);

    /**
     * The initial state of the form.
     * This only changes when the user submits the form. This state is copied from useLoaderData into React state.
     */
    const [cleanFormState, setCleanFormState] = useState(qrCode);

    /**
     * Determines if the form has changed. 
     * This is used to enable save buttons when the app user has changed the form contents, or disable them when the form contents haven't changed.
     */
    const isDirty = JSON.stringify(formState) !== JSON.stringify(cleanFormState);

    const nav = useNavigation();

    /**
     * Keeps track of the network state using useNavigation. 
     * This state is used to disable buttons and show loading states.
     */
    const isSaving = nav.state === "submitting" && nav.formData?.get("action") !== "delete";

    /**
     * Keeps track of the network state using useNavigation. 
     * This state is used to disable buttons and show loading states.
     */
    const isDeleting = nav.state === "submitting" && nav.formData?.get("action") === "delete";

    const navigate = useNavigate();

    /**
     * Using the App Bridge ResourcePicker action, add a modal that allows the user to select a product. 
     * Save the selection to form state.
     */
    async function selectProduct() {
        const products = await window.shopify.resourcePicker({
            type: "product",
            action: "select", // customized action verb, either 'select' or 'add',
        });

        if (products) {
            const { images, id, variants, title, handle } = products[0];

            setFormState({
                ...formState,
                productId: id,
                productVariantId: variants[0].id,
                productTitle: title,
                productHandle: handle,
                productAlt: images[0]?.altText,
                productImage: images[0]?.originalSrc,
            });
        }
    }

    /**
     * Use the useSubmit Remix hook to save the form data.
     * Copy the data that Prisma needs from formState and set the cleanFormState to the current formState.
     */
    const submit = useSubmit();
    function handleSave() {

        const data = {
            title: formState.title,
            productId: formState.productId || "",
            productVariantId: formState.productVariantId || "",
            productHandle: formState.productHandle || "",
            destination: formState.destination,
        };

        setCleanFormState({ ...formState });

        submit(data, { method: "post" });
    }

    return (
        <Page>
            {/* 
            Use an App Bridge ui-title-bar action to display a title that indicates to the user whether they're creating or editing a QR code. 
            Include a breadcrumb link to go back to the QR code list.
            */}
            <ui-title-bar title={qrCode.id ? "Edit QR code" : "Create new QR code"}>
                <button variant="breadcrumb" onClick={() => navigate("/app")}>
                    QR codes
                </button>
            </ui-title-bar>
            <Layout>
                <Layout.Section>
                    <VerticalStack gap="5">

                        {/* Add a title field */}
                        <Card>
                            <VerticalStack gap="5">
                                <Text as={"h2"} variant="headingLg">
                                    Title
                                </Text>
                                <TextField
                                    id="title"
                                    helpText="Only store staff can see this title"
                                    label="title"
                                    labelHidden
                                    autoComplete="off"
                                    value={formState.title}
                                    onChange={(title) => setFormState({ ...formState, title })}
                                    error={errors.title}
                                />
                            </VerticalStack>
                        </Card>

                        {/* Add a way to select the product */}
                        <Card>
                            <VerticalStack gap="5">
                                <HorizontalStack align="space-between">
                                    <Text as={"h2"} variant="headingLg">
                                        Product
                                    </Text>
                                    {formState.productId ? (
                                        <Button plain onClick={selectProduct}>
                                            Change product
                                        </Button>
                                    ) : null}
                                </HorizontalStack>
                                {formState.productId ? (
                                    <HorizontalStack blockAlign="center" gap={"5"}>
                                        <Thumbnail
                                            source={formState.productImage || ImageMajor}
                                            alt={formState.productAlt}
                                        />
                                        <Text as="span" variant="headingMd" fontWeight="semibold">
                                            {formState.productTitle}
                                        </Text>
                                    </HorizontalStack>
                                ) : (
                                    <VerticalStack gap="2">
                                        <Button onClick={selectProduct} id="select-product">
                                            Select product
                                        </Button>
                                        {errors.productId ? (
                                            <InlineError
                                                message={errors.productId}
                                                fieldID="myFieldID"
                                            />
                                        ) : null}
                                    </VerticalStack>
                                )}
                                <Bleed marginInline="20">
                                    <Divider />
                                </Bleed>

                                {/* Add destination options */}
                                <HorizontalStack
                                    gap="5"
                                    align="space-between"
                                    blockAlign="start"
                                >
                                    <ChoiceList
                                        title="Scan destination"
                                        choices={[
                                            { label: "Link to product page", value: "product" },
                                            {
                                                label: "Link to checkout page with product in the cart",
                                                value: "cart",
                                            },
                                        ]}
                                        selected={[formState.destination]}
                                        onChange={(destination) =>
                                            setFormState({
                                                ...formState,
                                                destination: destination[0],
                                            })
                                        }
                                        error={errors.destination}
                                    />
                                    {qrCode.destinationUrl ? (
                                        <Button plain url={qrCode.destinationUrl} external>
                                            Go to destination URL
                                        </Button>
                                    ) : null}
                                </HorizontalStack>
                            </VerticalStack>
                        </Card>
                    </VerticalStack>
                </Layout.Section>
                <Layout.Section secondary>

                    {/* Display a preview of the QR code */}
                    <Card>
                        <Text as={"h2"} variant="headingLg">
                            QR code
                        </Text>
                        {qrCode ? (
                            <EmptyState image={qrCode.image} imageContained={true} />
                        ) : (
                            <EmptyState image="">
                                Your QR code will appear here after you save
                            </EmptyState>
                        )}
                        <VerticalStack gap="3">
                            <Button
                                disabled={!qrCode?.image}
                                url={qrCode?.image}
                                download
                                primary
                            >
                                Download
                            </Button>
                            <Button
                                disabled={!qrCode.id}
                                url={`/qrcodes/${qrCode.id}`}
                                external
                            >
                                Go to public URL
                            </Button>
                        </VerticalStack>
                    </Card>
                </Layout.Section>
                {/* Add save and delete buttons */}
                <Layout.Section>
                    <PageActions
                        secondaryActions={[
                            {
                                content: "Delete",
                                loading: isDeleting,
                                disabled: !qrCode.id || !qrCode || isSaving || isDeleting,
                                destructive: true,
                                outline: true,
                                onAction: () =>
                                    submit({ action: "delete" }, { method: "post" }),
                            },
                        ]}
                        primaryAction={{
                            content: "Save",
                            loading: isSaving,
                            disabled: !isDirty || isSaving || isDeleting,
                            onAction: handleSave,
                        }}
                    />
                </Layout.Section>
            </Layout>
        </Page>
    );
}
