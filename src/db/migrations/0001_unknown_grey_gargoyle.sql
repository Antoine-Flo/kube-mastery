CREATE TABLE "billing_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text DEFAULT 'paddle' NOT NULL,
	"notification_id" text NOT NULL,
	"event_type" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"payload" jsonb DEFAULT '{}' NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_events_notification_id_unique" UNIQUE("notification_id")
);
--> statement-breakpoint
CREATE TABLE "pending_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"plan_tier" text NOT NULL,
	"status" text NOT NULL,
	"paddle_subscription_id" text,
	"paddle_customer_id" text,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"linked_user_id" uuid,
	"linked_at" timestamp with time zone,
	"magic_link_sent_at" timestamp with time zone,
	"raw_data" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pending_subscriptions_paddle_subscription_id_unique" UNIQUE("paddle_subscription_id")
);
--> statement-breakpoint
ALTER TABLE "pending_subscriptions" ADD CONSTRAINT "pending_subscriptions_linked_user_id_users_id_fk" FOREIGN KEY ("linked_user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_events_notification_id_idx" ON "billing_events" USING btree ("notification_id");--> statement-breakpoint
CREATE INDEX "billing_events_event_type_idx" ON "billing_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "pending_subscriptions_email_idx" ON "pending_subscriptions" USING btree ("email");--> statement-breakpoint
CREATE INDEX "pending_subscriptions_status_idx" ON "pending_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pending_subscriptions_paddle_subscription_id_idx" ON "pending_subscriptions" USING btree ("paddle_subscription_id");