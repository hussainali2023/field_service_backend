import Stripe from "stripe";
import config from "../config/index.ts"

const stripe = new Stripe(config.STRIPE_SECRET_KEY as string);

export default stripe;
