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
ALTER TABLE "billing_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"target_id" text NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "completions_user_type_target_unique" UNIQUE("user_id","type","target_id")
);
--> statement-breakpoint
ALTER TABLE "completions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
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
ALTER TABLE "pending_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_tier" text NOT NULL,
	"status" text NOT NULL,
	"paddle_subscription_id" text,
	"paddle_customer_id" text,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_paddle_subscription_id_unique" UNIQUE("paddle_subscription_id")
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"lesson_id" text,
	"type" text NOT NULL,
	"name" text,
	"content" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"theme" text,
	"locale" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "completions" ADD CONSTRAINT "completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_subscriptions" ADD CONSTRAINT "pending_subscriptions_linked_user_id_users_id_fk" FOREIGN KEY ("linked_user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_events_notification_id_idx" ON "billing_events" USING btree ("notification_id");--> statement-breakpoint
CREATE INDEX "billing_events_event_type_idx" ON "billing_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "completions_user_id_idx" ON "completions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "completions_user_type_idx" ON "completions" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "pending_subscriptions_email_idx" ON "pending_subscriptions" USING btree ("email");--> statement-breakpoint
CREATE INDEX "pending_subscriptions_status_idx" ON "pending_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pending_subscriptions_paddle_subscription_id_idx" ON "pending_subscriptions" USING btree ("paddle_subscription_id");--> statement-breakpoint
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscriptions_paddle_subscription_id_idx" ON "subscriptions" USING btree ("paddle_subscription_id");--> statement-breakpoint
CREATE INDEX "messages_type_idx" ON "messages" USING btree ("type");--> statement-breakpoint
CREATE INDEX "messages_lesson_id_idx" ON "messages" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "messages_created_at_idx" ON "messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "messages_user_id_idx" ON "messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "preferences_user_id_idx" ON "preferences" USING btree ("user_id");--> statement-breakpoint
CREATE POLICY "Users cannot access billing events" ON "billing_events" AS PERMISSIVE FOR SELECT TO "authenticated" USING (false);--> statement-breakpoint
CREATE POLICY "Users cannot insert billing events" ON "billing_events" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "Users cannot update billing events" ON "billing_events" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "Users cannot delete billing events" ON "billing_events" AS PERMISSIVE FOR DELETE TO "authenticated" USING (false);--> statement-breakpoint
CREATE POLICY "Users can view their own completions" ON "completions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("completions"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "Users can insert their own completions" ON "completions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("completions"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "Users can update their own completions" ON "completions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("completions"."user_id" = (select auth.uid())) WITH CHECK ("completions"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "Users can delete their own completions" ON "completions" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("completions"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "Users can view their linked pending subscriptions" ON "pending_subscriptions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("pending_subscriptions"."linked_user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "Users can update their linked pending subscriptions" ON "pending_subscriptions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("pending_subscriptions"."linked_user_id" = (select auth.uid())) WITH CHECK ("pending_subscriptions"."linked_user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "Users cannot insert pending subscriptions" ON "pending_subscriptions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "Users cannot delete pending subscriptions" ON "pending_subscriptions" AS PERMISSIVE FOR DELETE TO "authenticated" USING (false);--> statement-breakpoint
CREATE POLICY "Users can view their own subscriptions" ON "subscriptions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("subscriptions"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "Users can insert their own subscriptions" ON "subscriptions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("subscriptions"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "Users can update their own subscriptions" ON "subscriptions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("subscriptions"."user_id" = (select auth.uid())) WITH CHECK ("subscriptions"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "Users can delete their own subscriptions" ON "subscriptions" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("subscriptions"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "Allow authenticated insert on messages" ON "messages" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("messages"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "Users can view their own messages" ON "messages" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("messages"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "Allow service role to manage messages" ON "messages" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "Users can view their own preferences" ON "preferences" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("preferences"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "Users can insert their own preferences" ON "preferences" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("preferences"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "Users can update their own preferences" ON "preferences" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("preferences"."user_id" = (select auth.uid())) WITH CHECK ("preferences"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "Users can delete their own preferences" ON "preferences" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("preferences"."user_id" = (select auth.uid()));