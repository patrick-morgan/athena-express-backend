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
  buildObjectivityPrompt,
  HTMLParseResponseSchema,
  buildQuickParsingPrompt,
  QuickParseResponse,
  QuickParseParseResponseSchema,
  buildDateUpdatedPrompt,
  DateUpdatedResponseSchema,
  DateUpdatedResponse,
} from "./prompts/prompts";
import { getOrCreatePublication } from "./publication";
import { ArticleData } from "./types";
import { analyzeJournalistById, JournalistBiasWithName } from "./journalist";

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
      // console.info("Customer:", customer);

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
              unit_amount: 500, //500, // $5.00
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

app.get("/articles/by-url", async (req: Request, res: Response) => {
  const { url } = req.query;
  console.info("Request received for articles/by-url", { url });

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Invalid URL parameter" });
  }

  try {
    // Fetch the article
    const article = await prismaLocalClient.article.findFirst({
      where: { url },
      include: {
        article_authors: {
          include: {
            journalist: true,
          },
        },
        publicationObject: true,
      },
    });
    console.info("article", article);

    if (!article) {
      return res.json({ article: null });
    }

    const authors = article.article_authors.map(
      (author) => author.journalist_id
    );

    type JournalistBiasWithName = journalist_bias & { name: string };
    const outJournalistBiases: JournalistBiasWithName[] = [];

    for (const journalistId of authors) {
      const journalist = await prismaLocalClient.journalist.findFirst({
        where: { id: journalistId },
        include: { article_authors: true },
      });

      if (!journalist) {
        continue;
      }

      const journalistBias = await prismaLocalClient.journalist_bias.findFirst({
        where: { journalist: journalist.id },
      });

      if (journalistBias) {
        outJournalistBiases.push({ name: journalist.name, ...journalistBias });
      }
    }
    console.info("outJournalistBiases", outJournalistBiases.length);

    // Fetch journalists analysis
    // const journalistsAnalysis = await prismaLocalClient.journalist_bias.findMany({
    //   where: {
    //     journalist: {
    //       id: {
    //         in: article.article_authors.map((aa) => aa.journalist.id),
    //       },
    //     },
    //   },
    //   include: {
    //     journalist: true,
    //   },
    // });

    // Fetch publication analysis
    const publicationAnalysis =
      await prismaLocalClient.publication_bias.findFirst({
        where: {
          publication: article.publication,
        },
        orderBy: {
          created_at: "desc",
        },
        include: {
          publicationObject: true,
        },
      });
    console.info("publicationAnalysis", publicationAnalysis);

    // Get summary
    const summary = await prismaLocalClient.summary.findFirst({
      where: { article_id: article.id },
    });

    // Get political bias
    const politicalBias = await prismaLocalClient.polarization_bias.findFirst({
      where: { article_id: article.id },
    });

    // Get objectivity bias
    const objectivityBias = await prismaLocalClient.objectivity_bias.findFirst({
      where: { article_id: article.id },
    });

    const journalists = await prismaLocalClient.journalist.findMany({
      where: {
        id: {
          in: article.article_authors.map((aa) => aa.journalist_id),
        },
      },
    });

    // Prepare the response
    const response = {
      article,
      summary: summary?.summary ?? "",
      journalists,
      political_bias_score: politicalBias?.bias_score,
      objectivity_score: objectivityBias?.rhetoric_score,
      journalistsAnalysis: outJournalistBiases,
      publicationAnalysis: publicationAnalysis
        ? {
            publication: publicationAnalysis.publicationObject,
            analysis: {
              id: publicationAnalysis.id,
              publication: publicationAnalysis.publication,
              num_articles_analyzed: publicationAnalysis.num_articles_analyzed,
              rhetoric_score: publicationAnalysis.rhetoric_score,
              bias_score: publicationAnalysis.bias_score,
              summary: publicationAnalysis.summary,
              created_at: publicationAnalysis.created_at,
              updated_at: publicationAnalysis.updated_at,
            },
          }
        : null,
    };

    console.info("Sending response");

    res.json(response);
  } catch (error) {
    console.error("Error fetching article by URL:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/articles/date-updated", async (req: Request, res: Response) => {
  const { url, head, body } = req.body;

  try {
    let article = await prismaLocalClient.article.findFirst({
      where: { url },
      include: { article_authors: true, publicationObject: true },
    });

    if (!article) {
      return res.json({ article: null, needsUpdate: false });
    }

    console.info("Existing article.date_updated", article.date_updated);

    // Check for date_updated
    const bodySubset = body.slice(0, 1000);
    const requestPayload = {
      prompt: buildDateUpdatedPrompt(head, bodySubset, article.date_updated),
      zodSchema: DateUpdatedResponseSchema,
      propertyName: "date_updated",
    };

    const response = await gptApiCall(requestPayload);
    const parsedData: DateUpdatedResponse = response.choices[0].message.parsed;

    console.info("date updated parsed data", parsedData);

    let needsUpdate = false;

    const normalizeDate = (dateString: string): string => {
      const date = new Date(dateString);
      return date.toISOString().split(".")[0] + "Z";
    };

    if (parsedData.date_updated) {
      console.info("parsedData.date_updated", parsedData.date_updated);
      // const newDateUpdated = new Date(parsedData.date_updated);
      const normalizedParsed = normalizeDate(parsedData.date_updated);
      const normalizedCurrent = article.date_updated
        ? normalizeDate(article.date_updated.toISOString())
        : null;

      if (!normalizedCurrent || normalizedParsed !== normalizedCurrent) {
        // needsUpdate = true;
        return res.json({ needsUpdate: true });
        // article = await prismaLocalClient.article.update({
        //   where: { id: article.id },
        //   data: { date_updated: new Date(normalizedParsed) },
        //   include: { article_authors: true, publicationObject: true },
        // });
      }

      // if (!article.date_updated || newDateUpdated !== article.date_updated) {
      //   if (!article.date_updated) {
      //     console.info("article.date_updated is null, setting it");
      //   }
      //   // if (article.date_updated && newDateUpdated > article.date_updated) {
      //   //   console.log("greater than condition");
      //   //   console.log("new date updated", newDateUpdated);
      //   //   console.log("article.date_updated", article.date_updated);
      //   // }
      //   console.info("updating date_updated", newDateUpdated);
      //   article = await prismaLocalClient.article.update({
      //     where: { id: article.id },
      //     data: { date_updated: newDateUpdated },
      //     include: { article_authors: true, publicationObject: true },
      //   });
      //   needsUpdate = true;
      // }
    }

    // let summary: any | null = null;
    // let politicalBias: any | null = null;
    // let objectivityBias: any | null = null;
    // let journalists: any | null = null;

    // if (!needsUpdate) {
    //   // Fetch summary, political bias, and objectivity bias
    //   summary = await prismaLocalClient.summary.findFirst({
    //     where: { article_id: article.id },
    //   });
    //   politicalBias = await prismaLocalClient.polarization_bias.findFirst({
    //     where: { article_id: article.id },
    //   });
    //   objectivityBias = await prismaLocalClient.objectivity_bias.findFirst({
    //     where: { article_id: article.id },
    //   });
    //   journalists = await prismaLocalClient.journalist.findMany({
    //     where: {
    //       id: {
    //         in: article.article_authors.map((aa) => aa.journalist_id),
    //       },
    //     },
    //   });
    // }
    res.json({ needsUpdate: false });

    // res.json({
    //   article,
    //   needsUpdate,
    //   journalists,
    //   summary: summary?.summary || null,
    //   political_bias_score: politicalBias?.bias_score || null,
    //   objectivity_score: objectivityBias?.rhetoric_score || null,
    // });
  } catch (error) {
    console.error("Error in date-updated check:", error);
    res.status(500).json({ error: "Error in date-updated check" });
  }
});

// Quick parse route
app.post("/articles/quick-parse", async (req: Request, res: Response) => {
  const {
    url,
    hostname,
    head,
    body,
  }: {
    url: string;
    hostname: string;
    head: string;
    body: string;
  } = req.body;

  console.info("Engaging quick parse");

  try {
    // Check if the article already exists
    let article = await prismaLocalClient.article.findFirst({
      where: { url },
      include: { article_authors: true, publicationObject: true },
    });

    console.log("article", article?.id);

    const requestPayload = {
      prompt: buildQuickParsingPrompt(head, body),
      zodSchema: QuickParseParseResponseSchema,
      propertyName: "article_data",
    };

    const gptResponse = await gptApiCall(requestPayload);
    // try {
    //   const gptResponse = await gptApiCall(requestPayload);
    //   // ... rest of the code ...
    // } catch (gptError) {
    //   console.error("GPT API Error details:", {
    //     error: gptError,
    //   });
    //   throw gptError;
    // }
    console.log("gpt response", gptResponse);
    const parsedData: QuickParseResponse =
      gptResponse.choices[0].message.parsed;
    console.info("parsedData", parsedData);

    if (article) {
      // Update existing article
      console.info("Updating existing article", article.id);
      article = await prismaLocalClient.article.update({
        where: { id: article.id },
        include: {
          article_authors: {
            include: {
              journalist: true,
            },
          },
          publicationObject: true,
        },
        data: {
          title: parsedData.title,
          date_published: parsedData.date_published
            ? new Date(parsedData.date_published)
            : article.date_published,
          date_updated: parsedData.date_updated
            ? new Date(parsedData.date_updated)
            : article.date_updated
            ? article.date_updated
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
            : datePublished,
          text: head + body,
          publication: (await getOrCreatePublication(hostname)).id,
        },
        include: {
          article_authors: {
            include: {
              journalist: true,
            },
          },
          publicationObject: true,
        },
      });

      // Create summary
      await prismaLocalClient.summary.create({
        data: {
          article_id: article.id,
          summary: parsedData.summary,
          footnotes: {},
        },
      });

      // Create political bias
      await prismaLocalClient.polarization_bias.create({
        data: {
          article_id: article.id,
          bias_score: parsedData.political_bias_score,
          analysis: "",
          footnotes: {},
        },
      });

      // Create objectivity bias
      await prismaLocalClient.objectivity_bias.create({
        data: {
          article_id: article.id,
          rhetoric_score: parsedData.objectivity_score,
          analysis: "",
          footnotes: {},
        },
      });
    }

    const updatedArticle = await updateAuthors(
      article.id,
      parsedData.authors,
      article.publication
    );

    const publication = await prismaLocalClient.publication.findUnique({
      where: { id: updatedArticle.publication },
    });

    const journalists = await prismaLocalClient.journalist.findMany({
      where: {
        id: {
          in: updatedArticle.article_authors.map((aa) => aa.journalist_id),
        },
      },
    });

    const response = {
      article: updatedArticle,
      publication: publication,
      journalists: journalists,
      summary: parsedData.summary,
      political_bias_score: parsedData.political_bias_score,
      objectivity_score: parsedData.objectivity_score,
    };

    console.info("article_quick_parsed", {
      article: response,
      summary: parsedData.summary,
      political_bias_score: parsedData.political_bias_score,
      objectivity_score: parsedData.objectivity_score,
    });
    res.json(response);
  } catch (error) {
    console.error("Error in quick parse:", error);
    res.status(500).json({ error: "Error in quick parse" });
  }
});

// Full parse route
app.post("/articles/full-parse", async (req: Request, res: Response) => {
  const { url, html } = req.body;
  console.time("full-parse");

  try {
    console.time("parser-initialization");
    const parser = getParser(url, html);
    console.timeEnd("parser-initialization");

    console.time("article-parsing");
    const articleData: ArticleData = await parser.parse();
    console.timeEnd("article-parsing");

    console.info("articleData", articleData);

    console.time("find-existing-article");
    let article = await prismaLocalClient.article.findFirst({
      where: { url },
      include: { article_authors: true },
    });
    console.timeEnd("find-existing-article");

    console.time("article-upsert");
    if (article) {
      console.info("Updating existing article", article.id);
      article = await prismaLocalClient.article.update({
        where: { id: article.id },
        include: { article_authors: true },
        data: {
          title: articleData.title,
          date_published: articleData.date_published,
          date_updated: articleData.date_updated,
          text: articleData.text,
        },
      });
    } else {
      console.info("Creating new article");
      article = await prismaLocalClient.article.create({
        data: {
          url,
          title: articleData.title,
          date_published: articleData.date_published,
          date_updated: articleData.date_updated,
          text: articleData.text,
          publication: (await getOrCreatePublication(articleData.hostname)).id,
        },
        include: { article_authors: true },
      });
    }
    console.timeEnd("article-upsert");

    console.info("Updating authors", article.id, articleData.authors);

    console.time("update-authors");
    const updatedArticle = await updateAuthors(
      article.id,
      articleData.authors,
      article.publication
    );
    console.timeEnd("update-authors");

    console.info("Updated authors", updatedArticle.article_authors);

    console.time("fetch-publication");
    const publication = await prismaLocalClient.publication.findUnique({
      where: { id: updatedArticle.publication },
    });
    console.timeEnd("fetch-publication");

    console.info("publication", publication);

    console.time("fetch-journalists");
    const journalists = await prismaLocalClient.journalist.findMany({
      where: {
        id: {
          in: updatedArticle.article_authors.map((aa) => aa.journalist_id),
        },
      },
    });
    console.timeEnd("fetch-journalists");

    console.info("journalists", journalists.length);

    const response = {
      article: updatedArticle,
      publication: publication!,
      journalists: journalists,
    };

    console.info("article_full_parsed", { article: response });
    console.timeEnd("full-parse");
    res.json(response);
  } catch (error) {
    console.error("Error in full parse:", error);
    console.timeEnd("full-parse");
    res.status(500).json({ error: "Error in full parse" });
  }
});

// // Publication metadata route
// app.post("/publication-metadata", async (req: Request, res: Response) => {
//   const { hostname } = req.body;

//   try {
//     const publication = await getOrCreatePublication(hostname);
//     res.json(publication);
//   } catch (error) {
//     console.error("Error fetching publication metadata:", error);
//     res.status(500).json({ error: "Error fetching publication metadata" });
//   }
// });

// async function getOrCreatePublication(hostname: string) {
//   let publication = await prismaLocalClient.publication.findFirst({
//     where: { hostname },
//   });

//   if (!publication) {
//     const publication = await fetchPublicationMetadata(hostname);
//     // publication = await prismaLocalClient.publication.create({
//     //   data: {
//     //     hostname,
//     //     name: metadata.name,
//     //     date_founded: metadata.date_founded
//     //       ? new Date(metadata.date_founded)
//     //       : null,
//     //   },
//     // });
//   }

//   return publication.id;
// }

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
    include: {
      article_authors: {
        include: {
          journalist: true,
        },
      },
      publicationObject: true,
    },
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

// New route for analyzing a single journalist
app.post(
  "/analyze-journalist",
  async (req: Request<{}, {}, { journalistId: string }>, res: Response) => {
    const { journalistId } = req.body;

    try {
      const journalistAnalysis = await analyzeJournalistById(journalistId);
      res.json(journalistAnalysis);
    } catch (error) {
      console.error("Error analyzing journalist:", error);
      res.status(500).json({ error: "Error analyzing journalist" });
    }
  }
);

type AnalyzeJournalistsPayload = {
  articleId: string;
};

// Updated route for analyzing multiple journalists
app.post(
  "/analyze-journalists",
  async (req: Request<{}, {}, AnalyzeJournalistsPayload>, res: Response) => {
    const { articleId } = req.body;

    try {
      const article = await prismaLocalClient.article.findFirst({
        where: { id: articleId },
        include: {
          article_authors: true,
        },
      });

      if (!article) {
        console.error("Error analyzing journalists -- Article not found");
        return res.status(404).json({ error: "Article not found" });
      }

      const authors = article.article_authors.map(
        (author) => author.journalist_id
      );
      const journalistAnalyses: JournalistBiasWithName[] = await Promise.all(
        authors.map(analyzeJournalistById)
      );

      res.json(journalistAnalyses);
    } catch (error) {
      console.error("Error analyzing journalists:", error);
      res.status(500).json({ error: "Error analyzing journalists" });
    }
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
    console.log("generating summary fish", articleId);
    console.log("Text", text);
    console.log("summary prompt", buildSummaryPrompt(text));
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

app.get(
  "/journalists/:journalistId/articles",
  async (req: Request, res: Response) => {
    const { journalistId } = req.params;

    try {
      const articles = await prismaLocalClient.article.findMany({
        where: {
          article_authors: {
            some: {
              journalist_id: journalistId,
            },
          },
        },
        select: {
          id: true,
          url: true,
          title: true,
          date_published: true,
          date_updated: true,
          publication: true,
          article_authors: {
            select: {
              journalist: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          publicationObject: {
            select: {
              id: true,
              name: true,
              hostname: true,
            },
          },
        },
        orderBy: {
          date_published: "desc",
        },
        take: 20, // Limit to 20 articles
      });

      // Format the response
      const formattedArticles = articles.map((article) => ({
        ...article,
        text: "", // Set text to empty string
        journalists: article.article_authors.map((aa) => aa.journalist),
        publication: article.publicationObject,
        article_authors: undefined, // Remove this field from the response
        publicationObject: undefined, // Remove this field from the response
      }));

      res.json({ articles: formattedArticles });
    } catch (error) {
      console.error("Error fetching journalist articles:", error);
      res.status(500).json({ error: "Error fetching journalist articles" });
    }
  }
);

app.get(
  "/publications/:publicationId/articles",
  async (req: Request, res: Response) => {
    const { publicationId } = req.params;

    try {
      const articles = await prismaLocalClient.article.findMany({
        where: {
          publication: publicationId,
        },
        include: {
          article_authors: {
            include: {
              journalist: true,
            },
          },
          publicationObject: true,
        },
        orderBy: {
          date_published: "desc",
        },
        take: 20, // Limit to 20 articles, adjust as needed
      });

      // Format the response to match ArticleModel
      const formattedArticles = articles.map((article) => ({
        id: article.id,
        url: article.url,
        title: article.title,
        date_published: article.date_published,
        date_updated: article.date_updated,
        text: "", // Set to empty string to reduce payload size
        journalists: article.article_authors.map((aa) => ({
          id: aa.journalist.id,
          name: aa.journalist.name,
        })),
        publication: {
          id: article.publicationObject.id,
          name: article.publicationObject.name,
          hostname: article.publicationObject.hostname,
        },
      }));

      res.json({ articles: formattedArticles });
    } catch (error) {
      console.error("Error fetching publication articles:", error);
      res.status(500).json({ error: "Error fetching publication articles" });
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

// Catch-all route for debugging
app.use("*", (req, res) => {
  console.info(`Received request for ${req.originalUrl}`);
  res.status(404).send("Not Found");
});

const PORT = process.env.PORT || 3000;
console.log("env port", process.env.port);
console.log("running on port", PORT);
app.listen(PORT, () => {
  console.info(`Server is running on port ${PORT}`);
});
