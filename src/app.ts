import { PrismaClient, journalist_bias } from "@prisma/client";
import bodyParser from "body-parser";
import cors from "cors";
import Decimal from "decimal.js";
import express, { NextFunction, Request, Response } from "express";
import admin from "firebase-admin";
import { DecodedIdToken } from "firebase-admin/auth";
// import NodeCache from "node-cache";
import Stripe from "stripe";
import { getHostname } from "./parsers/helpers";
import { getParser } from "./parsers/parsers";
import {
  JournalistAnalysisData,
  PublicationAnalysisData,
  analyzeJournalistBias,
  analyzePublicationBias,
  gptApiCall,
} from "./prompts/chatgpt";
import {
  SummaryResponseSchema,
  PoliticalBiasResponseSchema,
  ObjectivityBiasResponseSchema,
  SummaryResponse,
  PoliticalBiasResponse,
  ObjectivityBiasResponse,
  buildSummaryPrompt,
  buildPoliticalBiasPrompt,
  buildHtmlParsingPrompt,
  buildObjectivityPrompt,
  HTMLParseResponseSchema,
} from "./prompts/prompts";
import { fetchPublicationMetadata } from "./publication";
import { ArticleData } from "./types";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
// const cache = new NodeCache({ stdTTL: 300 }); // Cache for 5 minutes

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
  }),
});

export const prismaLocalClient = new PrismaClient();

const app = express();

const EXTENSION_ID = "bpanflelokmegihakihekhnmbghkpnoh";
const corsOptions = {
  origin: [
    `chrome-extension://${EXTENSION_ID}`,
    "http://localhost:3000", // For local development
  ],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: "10mb" }));

// Use JSON body parser for all routes except the webhook
app.use((req, res, next) => {
  if (req.originalUrl === "/stripe-webhook") {
    next();
  } else {
    // bodyParser.json()(req, res, next);
    bodyParser.json({ limit: "10mb" })(req, res, next);
  }
});

interface AuthenticatedRequest extends Request {
  user?: DecodedIdToken;
}

// Middleware to verify Firebase token
const verifyFirebaseToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Error verifying Firebase token:", error);
    res.status(401).json({ error: "Invalid token" });
  }
};

app.get(
  "/check-subscription",
  verifyFirebaseToken,
  async (req: AuthenticatedRequest, res: Response) => {
    console.info("Check subscription request received");
    const userId = req.user?.uid;
    const userEmail = req.user?.email;

    console.info(
      `Checking subscription for User ID ${userId}, email ${userEmail}`
    );

    if (!userId || !userEmail) {
      console.info("User ID or email not found in token");
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      // Check cache first
      // const cachedStatus = cache.get<boolean>(userId);
      // console.info("Cached status:", cachedStatus);
      // if (cachedStatus !== undefined) {
      //   return res.json({ isSubscribed: cachedStatus });
      // }

      // If not in cache, check with Stripe
      const customer = await stripe.customers.list({
        email: userEmail,
        limit: 1,
      });
      console.info("Customer:", customer);

      if (customer.data.length === 0) {
        // cache.set(userId, false);
        return res.json({ isSubscribed: false });
      }

      const subscriptions = await stripe.subscriptions.list({
        customer: customer.data[0].id,
        status: "active",
      });

      const isSubscribed = subscriptions.data.length > 0;
      console.info("Is subscribed:", isSubscribed);

      // Update cache
      // cache.set(userId, isSubscribed);

      res.json({ isSubscribed });
    } catch (error) {
      console.error("Error checking subscription:", error);
      res.status(500).json({ error: "Error checking subscription status" });
    }
  }
);

// Helper function to get or create a Stripe customer
async function getOrCreateStripeCustomer(
  firebaseUserId: string,
  email: string
) {
  let customer;
  const customers = await stripe.customers.list({ email: email, limit: 1 });

  if (customers.data.length > 0) {
    customer = customers.data[0];
    // Update the customer with Firebase UID if it's not already there
    if (!customer.metadata.firebaseUID) {
      customer = await stripe.customers.update(customer.id, {
        metadata: { firebaseUID: firebaseUserId },
      });
    }
  } else {
    // Create a new customer with Firebase UID in metadata
    customer = await stripe.customers.create({
      email: email,
      metadata: { firebaseUID: firebaseUserId },
    });
  }

  return customer;
}

app.post(
  "/create-checkout-session",
  verifyFirebaseToken,
  async (req: AuthenticatedRequest, res: Response) => {
    console.info("Request received for create-checkout-session");
    console.info("User from token:", req.user);

    const firebaseUserId = req.user?.uid;
    const userEmail = req.user?.email;

    if (!firebaseUserId || !userEmail) {
      console.info("User ID or email not found in token");
      return res.status(400).json({ error: "User ID or email not found" });
    }

    try {
      console.info(
        "Creating Stripe checkout session for user:",
        firebaseUserId
      );

      // Get or create a Stripe customer
      const customer = await getOrCreateStripeCustomer(
        firebaseUserId,
        userEmail
      );

      const session = await stripe.checkout.sessions.create({
        customer: customer.id,
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "Athena AI Subscription",
              },
              unit_amount: 0, //500, // $5.00
              recurring: {
                interval: "month",
              },
            },
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: `https://${process.env.PEOPLES_PRESS_DOMAIN}/extension-redirect?status=success`,
        cancel_url: `https://${process.env.PEOPLES_PRESS_DOMAIN}/extension-redirect?status=cancel`,
        client_reference_id: firebaseUserId,
      });

      console.info("Checkout session created:", session.id);
      res.json({ checkoutUrl: session.url });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ error: "Error creating checkout session" });
    }
  }
);

// Webhook to handle Stripe events
app.post(
  "/stripe-webhook",
  bodyParser.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    console.info("Webhook request received", req.body);
    const sig = req.headers["stripe-signature"] as string | undefined;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig || "",
        process.env.STRIPE_WEBHOOK_SECRET || ""
      );
    } catch (err) {
      console.error(`Webhook Error: ${(err as Error).message}`);
      return res.status(400).send(`Webhook Error: ${(err as Error).message}`);
    }

    console.info(`Received webhook event: ${event.type}`);

    switch (event.type) {
      case "checkout.session.completed":
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        const subscription = event.data.object as Stripe.Subscription;
        console.info("Received subscription", subscription);
        await handleSubscriptionChange(subscription);
        break;
      // ... handle other event types as needed
    }

    res.json({ received: true });

    // try {
    //   switch (event.type) {
    //     case "checkout.session.completed":
    //       const session = event.data.object as Stripe.Checkout.Session;
    //       if (session.client_reference_id) {
    //         await handleSuccessfulSubscription(session.client_reference_id);
    //         console.log(
    //           `Subscription activated for user: ${session.client_reference_id}`
    //         );
    //       } else {
    //         console.error("No client_reference_id found in session");
    //       }
    //       break;
    //     case "customer.subscription.deleted":
    //       const subscription = event.data.object as Stripe.Subscription;
    //       if (subscription.customer) {
    //         const customerId =
    //           typeof subscription.customer === "string"
    //             ? subscription.customer
    //             : subscription.customer.id;
    //         const customer = await stripe.customers.retrieve(customerId);
    //         if ("deleted" in customer) {
    //           console.error("Customer has been deleted");
    //         } else if (customer.metadata && customer.metadata.firebaseUID) {
    //           await handleCancelledSubscription(customer.metadata.firebaseUID);
    //           console.log(
    //             `Subscription cancelled for user: ${customer.metadata.firebaseUID}`
    //           );
    //         } else {
    //           console.error("Firebase UID not found in customer metadata");
    //         }
    //       } else {
    //         console.error("No customer found in subscription");
    //       }
    //       break;
    //     default:
    //       console.log(`Unhandled event type ${event.type}`);
    //   }
    // } catch (error) {
    //   console.error(`Error processing webhook event ${event.type}:`, error);
    //   return res.status(500).json({ error: "Error processing webhook event" });
    // }

    // res.json({ received: true });
  }
);

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  console.info(
    `Handling subscription change for stripe customerId ${customerId}`
  );
  const customer = await stripe.customers.retrieve(customerId);

  if (customer.deleted) {
    console.error("Customer has been deleted");
    return;
  }

  const firebaseUid = customer.metadata.firebaseUID;
  if (!firebaseUid) {
    console.error("Firebase UID not found in customer metadata");
    return;
  }

  const isActive = subscription.status === "active";

  // Update cache
  // cache.set(firebaseUid, isActive);

  // Optionally, update your database here if you're still maintaining a local subscription table
  // await updateDatabaseSubscription(firebaseUid, isActive, subscription);

  console.info(
    `Updated subscription status for user ${firebaseUid}: ${isActive}`
  );
}

// Cancel subscription
app.post(
  "/cancel-subscription",
  verifyFirebaseToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const firebaseUserId = req.user?.uid;

    if (!firebaseUserId) {
      return res.status(400).json({ error: "User ID not found" });
    }

    try {
      const subscription = await prismaLocalClient.subscription.findUnique({
        where: { firebaseUserId },
      });

      if (!subscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      // Fetch Stripe subscriptions for the customer
      const stripeCustomer = await stripe.customers.list({
        email: req.user?.email,
        limit: 1,
      });

      if (stripeCustomer.data.length === 0) {
        return res.status(404).json({ error: "Stripe customer not found" });
      }

      const stripeSubscriptions = await stripe.subscriptions.list({
        customer: stripeCustomer.data[0].id,
        status: "active",
        limit: 1,
      });

      if (stripeSubscriptions.data.length === 0) {
        return res
          .status(404)
          .json({ error: "Active Stripe subscription not found" });
      }

      // Cancel the subscription in Stripe
      await stripe.subscriptions.cancel(stripeSubscriptions.data[0].id);

      // Update the subscription status in your database
      await prismaLocalClient.subscription.update({
        where: { firebaseUserId },
        data: { status: "cancelled", endDate: new Date() },
      });

      res.json({ message: "Subscription cancelled successfully" });
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      res.status(500).json({ error: "Error cancelling subscription" });
    }
  }
);

app.post(
  "/update-payment-method",
  verifyFirebaseToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const firebaseUserId = req.user?.uid;
    const userEmail = req.user?.email;

    if (!firebaseUserId || !userEmail) {
      return res.status(400).json({ error: "User ID or email not found" });
    }

    try {
      // Get or create a Stripe customer
      const customer = await getOrCreateStripeCustomer(
        firebaseUserId,
        userEmail
      );

      // Create a billing portal session
      const session = await stripe.billingPortal.sessions.create({
        customer: customer.id,
        return_url: `https://${process.env.PEOPLES_PRESS_DOMAIN}/extension-redirect?status=payment_updated`,
      });

      res.json({ updateUrl: session.url });
    } catch (error) {
      console.error("Error creating billing portal session:", error);
      res.status(500).json({ error: "Error updating payment method" });
    }
  }
);

type CreateArticlePayload = {
  url: string;
  html: string;
};

// // Create or get article
// app.post(
//   "/articles",
//   async (req: Request<{}, {}, CreateArticlePayload>, res: Response) => {
//     const { url, html } = req.body;

//     // Get article if it exists
//     const existingArticle = await prismaLocalClient.article.findFirst({
//       where: { url },
//       include: {
//         article_authors: true,
//       },
//     });

//     let title, subtitle, date_published, date_updated, text, authors, hostname;
//     if (existingArticle) {
//       title = existingArticle.title;
//       subtitle = existingArticle.subtitle;
//       date_published = existingArticle.date_published;
//       date_updated = existingArticle.date_updated;
//       text = existingArticle.text;
//       hostname = getHostname(url);
//       const author_ids = existingArticle.article_authors.map(
//         (author) => author.journalist_id
//       );
//       const authorObjects = await prismaLocalClient.journalist.findMany({
//         where: { id: { in: author_ids } },
//       });
//       authors = authorObjects.map((author) => author.name);
//     } else {
//       const parser = getParser(url, html);
//       const articleData: ArticleData = await parser.parse();
//       title = articleData.title;
//       subtitle = articleData.subtitle;
//       date_published = articleData.date_published;
//       date_updated = articleData.date_updated;
//       text = articleData.text;
//       authors = articleData.authors;
//       hostname = articleData.hostname;
//     }

//     const journalists = [];
//     let outArticle = null;

//     if (!text) {
//       console.error("Error parsing article");
//       return res.status(500).json({ error: "Error parsing article" });
//     }

//     try {
//       // Get publication by hostname
//       let publication = await prismaLocalClient.publication.findFirst({
//         where: { hostname },
//       });
//       console.info("Existing publication:", publication);

//       // If not found, create a new publication
//       if (!publication) {
//         const metadata = await fetchPublicationMetadata(hostname);
//         console.info("Publication metadata:", metadata);

//         if (metadata.date_founded) {
//           try {
//             const [month, day, year] = metadata.date_founded.split("/");
//             metadata.date_founded = `${year}-${month}-${day}`;
//           } catch (e) {
//             console.error("Error parsing publication metadata date:", e);
//             metadata.date_founded = null;
//           }
//         }

//         publication = await prismaLocalClient.publication.create({
//           data: {
//             hostname,
//             name: metadata.name,
//             date_founded: metadata.date_founded
//               ? new Date(metadata.date_founded)
//               : null,
//             // owner: metadata.owner,
//           },
//         });
//         console.info("Created publication:", publication);
//       }

//       // Get journalists by name/publication
//       for (let i = 0; i < authors.length; i++) {
//         let journalist = await prismaLocalClient.journalist.findFirst({
//           where: { name: authors[i], publication: publication.id },
//         });
//         console.info("Existing journalist:", journalist);
//         // If not found, create a new journalist
//         if (!journalist) {
//           journalist = await prismaLocalClient.journalist.create({
//             data: {
//               name: authors[i],
//               publication: publication.id,
//             },
//           });
//           console.info("Created journalist:", journalist);
//         }
//         journalists.push(journalist);
//       }

//       if (existingArticle) {
//         console.info("Existing article:", existingArticle);
//         outArticle = existingArticle;
//       } else {
//         // Create article
//         const newArticle = await prismaLocalClient.article.create({
//           data: {
//             title,
//             subtitle,
//             date_published,
//             date_updated,
//             url,
//             text,
//             publication: publication.id,
//             // summary: { connect: { id: summaryId } },
//             // polarization_bias: { connect: { id: polarizationBiasId } },
//             // objectivity_bias: { connect: { id: objectivityBiasId } },
//             article_authors: {
//               create: journalists.map((journalist) => ({
//                 journalist_id: journalist.id,
//               })),
//             },
//           },
//           // include: {
//           //   article_authors: true,
//           // },
//         });
//         outArticle = newArticle;
//         console.info("Created article:", newArticle);
//       }

//       res.json({
//         article: outArticle,
//         publication,
//         journalists,
//       });
//     } catch (error) {
//       console.error("Error creating article:", error);
//       res.status(500).json({ error: "Error creating article" });
//     }
//   }
// );

// Quick parse route
app.post("/articles/quick-parse", async (req: Request, res: Response) => {
  const { url, hostname, htmlSubset } = req.body;

  try {
    // Check if the article already exists
    let article = await prismaLocalClient.article.findFirst({
      where: { url },
      include: { article_authors: true },
    });

    // Parse the HTML subset
    const requestPayload = {
      prompt: buildHtmlParsingPrompt(htmlSubset),
      zodSchema: HTMLParseResponseSchema,
      propertyName: "article_data",
    };

    const gptResponse = await gptApiCall(requestPayload);
    const parsedData: ArticleData = gptResponse.choices[0].message.parsed;
    console.info("parsedData", parsedData);

    if (article) {
      // Update existing article
      console.info("Updating existing article", article.id);
      article = await prismaLocalClient.article.update({
        where: { id: article.id },
        include: { article_authors: true, publicationObject: true },
        data: {
          title: parsedData.title,
          date_updated: parsedData.date_updated
            ? new Date(parsedData.date_updated)
            : null,
        },
      });
    } else {
      // Create new article
      console.info("Creating new article");
      const datePublished = parsedData.date_published
        ? new Date(parsedData.date_published)
        : parsedData.date_updated
        ? new Date(parsedData.date_updated)
        : new Date();
      article = await prismaLocalClient.article.create({
        data: {
          url,
          title: parsedData.title,
          date_published: datePublished,
          date_updated: parsedData.date_updated
            ? new Date(parsedData.date_updated)
            : null,
          text: "",
          publication: await getOrCreatePublication(hostname),
        },
        include: { article_authors: true, publicationObject: true },
      });
    }

    const publication = await prismaLocalClient.publication.findUnique({
      where: { id: article.publication },
    });

    const journalists = await prismaLocalClient.journalist.findMany({
      where: {
        id: {
          in: article.article_authors.map((aa) => aa.journalist_id),
        },
      },
    });

    const response = {
      article,
      publication: publication,
      journalists: journalists,
    };

    console.info("article_quick_parsed", { article: response });
    res.json(response);
  } catch (error) {
    console.error("Error in quick parse:", error);
    res.status(500).json({ error: "Error in quick parse" });
  }
});

// Full parse route
app.post("/articles/full-parse", async (req: Request, res: Response) => {
  const { url, html } = req.body;

  try {
    const parser = getParser(url, html);
    const articleData: ArticleData = await parser.parse();

    console.info("articleData", articleData);

    let article = await prismaLocalClient.article.findFirst({
      where: { url },
      include: { article_authors: true },
    });

    if (article) {
      console.info("Updating existing article", article.id);
      // Update existing article
      article = await prismaLocalClient.article.update({
        where: { id: article.id },
        include: { article_authors: true },
        data: {
          title: articleData.title,
          date_updated: articleData.date_updated,
          text: articleData.text,
        },
      });
    } else {
      console.info("Creating new article");
      // Create new article
      article = await prismaLocalClient.article.create({
        data: {
          url,
          title: articleData.title,
          date_published: articleData.date_published,
          date_updated: articleData.date_updated,
          text: articleData.text,
          publication: await getOrCreatePublication(articleData.hostname),
        },
        include: { article_authors: true },
      });
    }

    console.info("Updating authors", article.id, articleData.authors);

    /// Update authors and get the updated article
    const updatedArticle = await updateAuthors(
      article.id,
      articleData.authors,
      article.publication
    );

    console.info("Updated authors", updatedArticle.article_authors);

    const publication = await prismaLocalClient.publication.findUnique({
      where: { id: updatedArticle.publication },
    });

    console.info("publication", publication);

    const journalists = await prismaLocalClient.journalist.findMany({
      where: {
        id: {
          in: updatedArticle.article_authors.map((aa) => aa.journalist_id),
        },
      },
    });

    console.info("journalists", journalists.length);

    const response = {
      article: updatedArticle,
      publication: publication!,
      journalists: journalists,
    };

    console.info("article_full_parsed", { article: response });
    res.json(response);
  } catch (error) {
    console.error("Error in full parse:", error);
    res.status(500).json({ error: "Error in full parse" });
  }
});

// Publication metadata route
app.post("/publication-metadata", async (req: Request, res: Response) => {
  const { hostname } = req.body;

  try {
    const publication = await fetchPublicationMetadata(hostname);
    res.json(publication);
  } catch (error) {
    console.error("Error fetching publication metadata:", error);
    res.status(500).json({ error: "Error fetching publication metadata" });
  }
});

async function getOrCreatePublication(hostname: string) {
  let publication = await prismaLocalClient.publication.findFirst({
    where: { hostname },
  });

  if (!publication) {
    const metadata = await fetchPublicationMetadata(hostname);
    publication = await prismaLocalClient.publication.create({
      data: {
        hostname,
        name: metadata.name,
        date_founded: metadata.date_founded
          ? new Date(metadata.date_founded)
          : null,
      },
    });
  }

  return publication.id;
}

async function updateAuthors(
  articleId: string,
  authorNames: string[],
  publicationId: string
) {
  // Remove existing authors
  await prismaLocalClient.article_authors.deleteMany({
    where: { article_id: articleId },
  });

  // Add new authors
  for (const name of authorNames) {
    let journalist = await prismaLocalClient.journalist.findFirst({
      where: { name },
    });

    if (!journalist) {
      journalist = await prismaLocalClient.journalist.create({
        data: { name, publication: publicationId },
      });
    }

    await prismaLocalClient.article_authors.create({
      data: {
        article_id: articleId,
        journalist_id: journalist.id,
      },
    });
  }

  // Fetch and return the updated article with authors
  const updatedArticle = await prismaLocalClient.article.findUnique({
    where: { id: articleId },
    include: { article_authors: true },
  });

  return updatedArticle!;
}

type PublicationBiasPayload = {
  publicationId: string;
};

// Create or get publication bias
app.post(
  "/analyze-publication",
  async (req: Request<{}, {}, PublicationBiasPayload>, res: Response) => {
    const { publicationId } = req.body;
    const publication = await prismaLocalClient.publication.findFirst({
      where: { id: publicationId },
    });
    if (!publication) {
      return res.status(500).json({ error: "Publication not found" });
    }
    // article_ids publication has written
    const articles = await prismaLocalClient.article.findMany({
      where: { publication: publicationId },
    });
    // If publication bias already exists with same # articles analyzed, return it
    const existingBias = await prismaLocalClient.publication_bias.findFirst({
      where: {
        publication: publicationId,
        num_articles_analyzed: articles.length,
      },
    });
    if (existingBias) {
      console.info("Existing publication bias:", existingBias);
      return res.json({
        publication,
        analysis: existingBias,
      });
    }
    // Create publication bias
    const articleIds = articles.map((article) => article.id);
    const analysis: PublicationAnalysisData = {
      averagePolarization: 50,
      averageObjectivity: 50,
      summaries: [],
    };
    const polarizationBiases =
      await prismaLocalClient.polarization_bias.findMany({
        where: { article_id: { in: articleIds } },
      });

    if (polarizationBiases.length > 0) {
      let totalPolarizationBiasScore = new Decimal(0);
      polarizationBiases.forEach((bias) => {
        totalPolarizationBiasScore = totalPolarizationBiasScore.plus(
          bias.bias_score
        );
      });
      const averagePolarizationBiasScore = totalPolarizationBiasScore.dividedBy(
        polarizationBiases.length
      );
      // Round to 1 decimal place
      analysis["averagePolarization"] = parseFloat(
        averagePolarizationBiasScore.toNumber().toFixed(1)
      );
    }

    const objectivityBiases = await prismaLocalClient.objectivity_bias.findMany(
      {
        where: { article_id: { in: articleIds } },
      }
    );
    if (objectivityBiases.length > 0) {
      let totalObjectivityBiasScore = new Decimal(0);
      objectivityBiases.forEach((bias) => {
        totalObjectivityBiasScore = totalObjectivityBiasScore.plus(
          bias.rhetoric_score
        );
      });
      const averageObjectivityBiasScore = totalObjectivityBiasScore.dividedBy(
        objectivityBiases.length
      );
      analysis["averageObjectivity"] = parseFloat(
        averageObjectivityBiasScore.toNumber().toFixed(1)
      );
    }

    // Take 10 most recent summaries
    const summaries = await prismaLocalClient.summary.findMany({
      where: { article_id: { in: articleIds } },
      orderBy: {
        created_at: "desc",
      },
      take: 10,
    });
    const summaryText: string[] = summaries.map((summary) => summary.summary);
    analysis["summaries"] = summaryText;
    console.info("Publication bias pre-analysis data struct", analysis);

    // Get publication analysis
    const publicationAnalysis = await analyzePublicationBias(analysis);
    if (!publicationAnalysis) {
      return res
        .status(500)
        .json({ error: "Error analyzing publication bias" });
    }
    // Construct new analysis
    const newPublicationBias = await prismaLocalClient.publication_bias.create({
      data: {
        publication: publicationId,
        num_articles_analyzed: articles.length,
        rhetoric_score: analysis.averageObjectivity,
        bias_score: analysis.averagePolarization,
        summary: publicationAnalysis.analysis,
      },
    });
    console.info("Created publication bias:", newPublicationBias);
    res.json({ publication, analysis: newPublicationBias });
  }
);

type AnalyzeJournalistsPayload = {
  articleId: string;
};
// Create or get journalists biases
app.post(
  "/analyze-journalists",
  async (req: Request<{}, {}, AnalyzeJournalistsPayload>, res: Response) => {
    const { articleId } = req.body;
    // Get article by id
    const article = await prismaLocalClient.article.findFirst({
      where: { id: articleId },
      include: {
        article_authors: true,
      },
    });
    if (!article) {
      console.error("Error analyzing journalists -- Article not found");
      return res.status(500).json({ error: "Article not found" });
    }
    const { title, date_published, date_updated, url, text, article_authors } =
      article;
    const hostname = getHostname(url);
    const authors = article_authors.map((author) => author.journalist_id);

    const publication = await prismaLocalClient.publication.findFirst({
      where: { hostname },
    });
    if (!publication) {
      return res.status(500).json({ error: "Publication not found" });
    }

    type JournalistBiasWithName = journalist_bias & { name: string };
    const outJournalistBiases: JournalistBiasWithName[] = [];

    for (const journalistId of authors) {
      const journalist = await prismaLocalClient.journalist.findFirst({
        where: { id: journalistId },
        include: { article_authors: true },
      });
      if (!journalist) {
        return res.status(500).json({ error: "Journalist not found" });
      }
      // Number of articles this journalist has written
      const numArticlesWritten = journalist.article_authors.length;
      // Get bias if num articles written is same as what we have already analyzed (hence no changes to re-analyze)
      const existingBias = await prismaLocalClient.journalist_bias.findFirst({
        where: {
          journalist: journalist.id,
          num_articles_analyzed: numArticlesWritten,
        },
      });
      if (existingBias) {
        console.info("Existing journalist bias:", existingBias);
        outJournalistBiases.push({ name: journalist.name, ...existingBias });
        continue;
      }
      // Create journalist bias
      // Aggregate all article_ids this journalist has written
      const articleIds = journalist.article_authors.map(
        (article) => article.article_id
      );
      // Average bias score of all articles this journalist has written
      const analysis: JournalistAnalysisData = {
        // journalist: journalist.id,
        averagePolarization: 50,
        averageObjectivity: 50,
        summaries: [],
      };

      const polarizationBiases =
        await prismaLocalClient.polarization_bias.findMany({
          where: { article_id: { in: articleIds } },
        });

      if (polarizationBiases.length > 0) {
        let totalPolarizationBiasScore = new Decimal(0);
        polarizationBiases.forEach((bias) => {
          totalPolarizationBiasScore = totalPolarizationBiasScore.plus(
            bias.bias_score
          );
        });
        const averagePolarizationBiasScore =
          totalPolarizationBiasScore.dividedBy(polarizationBiases.length);
        analysis["averagePolarization"] = parseFloat(
          averagePolarizationBiasScore.toNumber().toFixed(1)
        );
      }

      const objectivityBiases =
        await prismaLocalClient.objectivity_bias.findMany({
          where: { article_id: { in: articleIds } },
        });
      if (objectivityBiases.length > 0) {
        let totalObjectivityBiasScore = new Decimal(0);
        objectivityBiases.forEach((bias) => {
          totalObjectivityBiasScore = totalObjectivityBiasScore.plus(
            bias.rhetoric_score
          );
        });
        const averageObjectivityBiasScore = totalObjectivityBiasScore.dividedBy(
          objectivityBiases.length
        );
        analysis["averageObjectivity"] = parseFloat(
          averageObjectivityBiasScore.toNumber().toFixed(1)
        );
      }

      // Aggregate summaries of all articles this journalist has written
      const summaries = await prismaLocalClient.summary.findMany({
        where: { article_id: { in: articleIds } },
      });
      const summaryText: string[] = summaries.map((summary) => summary.summary);
      analysis["summaries"] = summaryText;
      console.info("Journalist bias pre-analysis data struct", analysis);

      // Get journalist analysis
      const journalistAnalysis = await analyzeJournalistBias(analysis);
      if (!journalistAnalysis) {
        return res
          .status(500)
          .json({ error: "Error analyzing journalist bias" });
      }
      // Construct new analysis
      const newJournalistBias = await prismaLocalClient.journalist_bias.create({
        data: {
          journalist: journalist.id,
          num_articles_analyzed: numArticlesWritten,
          rhetoric_score: analysis.averageObjectivity,
          bias_score: analysis.averagePolarization,
          summary: journalistAnalysis.analysis,
        },
      });
      console.info("Created journalist bias:", newJournalistBias);
      outJournalistBiases.push({
        name: journalist.name,
        ...newJournalistBias,
      });
    }
    console.info("Out journalist biases", outJournalistBiases);
    res.json(outJournalistBiases);
  }
);

type ArticlePayload = {
  id: string;
  text: string;
};

app.post(
  "/generate-summary",
  async (req: Request<{}, {}, ArticlePayload>, res: Response) => {
    const { text, id: articleId } = req.body;
    const requestPayload = {
      prompt: buildSummaryPrompt(text),
      zodSchema: SummaryResponseSchema,
      propertyName: "summary",
    };
    console.info("Request payload:", requestPayload);

    try {
      // Get article summary if it exists
      const existingSummary = await prismaLocalClient.summary.findFirst({
        where: { article_id: articleId },
      });
      if (existingSummary) {
        console.info("Existing article summary:", existingSummary);
        return res.json(existingSummary);
      }

      const response = await gptApiCall(requestPayload);
      let responseData: SummaryResponse = response.choices[0].message.parsed;
      console.info("Summary JSON response:", responseData);

      // Create the article summary
      const newArticleSummary = await prismaLocalClient.summary.create({
        data: {
          article_id: articleId,
          summary: responseData.summary,
          // footnotes: {},
          footnotes: responseData.footnotes,
        },
      });
      console.info("Created article summary:", newArticleSummary);
      res.json(newArticleSummary);
    } catch (error) {
      console.error("Error generating summary:", error);
      return res.status(500).json({ error: "Error generating summary" });
    }
  }
);

app.post(
  "/analyze-political-bias",
  async (req: Request<{}, {}, ArticlePayload>, res: Response) => {
    const { id: articleId, text } = req.body;
    const requestPayload = {
      prompt: buildPoliticalBiasPrompt(text),
      zodSchema: PoliticalBiasResponseSchema,
      propertyName: "political_bias",
    };

    try {
      // Get article political bias if it exists
      const existingBias = await prismaLocalClient.polarization_bias.findFirst({
        where: { article_id: articleId },
      });
      if (existingBias) {
        console.info("Existing article political bias:", existingBias);
        return res.json(existingBias);
      }

      const response = await gptApiCall(requestPayload);
      let responseData: PoliticalBiasResponse =
        response.choices[0].message.parsed;
      console.info("Political bias JSON response:", responseData);

      // Create article political bias
      const newArticleBias = await prismaLocalClient.polarization_bias.create({
        data: {
          article_id: articleId,
          analysis: responseData.analysis,
          bias_score: responseData.bias_score,
          footnotes: responseData.footnotes,
        },
      });
      console.info("Created article political bias:", newArticleBias);
      res.json(newArticleBias);
    } catch (error) {
      console.error("Error analyzing political bias:", error);
      return res.status(500).json({ error: "Error analyzing political bias" });
    }
  }
);

app.post(
  "/analyze-objectivity",
  async (req: Request<{}, {}, ArticlePayload>, res: Response) => {
    const { id: articleId, text } = req.body;
    const requestPayload = {
      prompt: buildObjectivityPrompt(text),
      zodSchema: ObjectivityBiasResponseSchema,
      propertyName: "objectivity_bias",
    };
    try {
      // Get article objectivity if it exists
      const existingBias = await prismaLocalClient.objectivity_bias.findFirst({
        where: { article_id: articleId },
      });
      if (existingBias) {
        console.info("Existing article objectivity:", existingBias);
        return res.json(existingBias);
      }

      const response = await gptApiCall(requestPayload);
      let responseData: ObjectivityBiasResponse =
        response.choices[0].message.parsed;
      console.info("Objectivity JSON response:", responseData);

      // Create article objectivity
      const newArticleBias = await prismaLocalClient.objectivity_bias.create({
        data: {
          article_id: articleId,
          analysis: responseData.analysis,
          rhetoric_score: responseData.rhetoric_score,
          footnotes: responseData.footnotes,
        },
      });
      console.info("Created article objectivity:", newArticleBias);
      res.json(newArticleBias);
    } catch (error) {
      console.error("Error analyzing objectivity:", error);
      return res.status(500).json({ error: "Error analyzing objectivity" });
    }
  }
);

// Get all articles
app.get("/articles", async (req, res) => {
  try {
    const articles = await prismaLocalClient.article.findMany({
      include: {
        article_authors: true,
        // publication_article_publicationTopublication: true,
        summary: true,
        polarization_bias: true,
        objectivity_bias: true,
      },
    });
    res.json(articles);
  } catch (error) {
    console.error("Error fetching articles:", error);
    res.status(500).json({ error: "Error fetching articles" });
  }
});

type PublicationMetadataRequestBody = {
  hostname: string;
};

// Route to get publication metadata
app.post(
  "/get-publication-metadata",
  async (
    req: Request<{}, {}, PublicationMetadataRequestBody>,
    res: Response
  ) => {
    const { hostname } = req.body;
    try {
      const metadata = await fetchPublicationMetadata(hostname);
      res.json(metadata);
    } catch (error) {
      console.error("Error fetching publication metadata:", error);
      res.status(500).json({ error: "Error fetching publication metadata" });
    }
  }
);

// Catch-all route for debugging
app.use("*", (req, res) => {
  console.info(`Received request for ${req.originalUrl}`);
  res.status(404).send("Not Found");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.info(`Server is running on port ${PORT}`);
});
