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
CREATE TABLE "progress" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"completed_lessons" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "progress" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress" ADD CONSTRAINT "progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscriptions_paddle_subscription_id_idx" ON "subscriptions" USING btree ("paddle_subscription_id");--> statement-breakpoint
CREATE INDEX "messages_type_idx" ON "messages" USING btree ("type");--> statement-breakpoint
CREATE INDEX "messages_lesson_id_idx" ON "messages" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "messages_created_at_idx" ON "messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "messages_user_id_idx" ON "messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "preferences_user_id_idx" ON "preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "progress_user_id_idx" ON "progress" USING btree ("user_id");--> statement-breakpoint
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
CREATE POLICY "Users can delete their own preferences" ON "preferences" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("preferences"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "Users can view their own progress" ON "progress" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("progress"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "Users can insert their own progress" ON "progress" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("progress"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "Users can update their own progress" ON "progress" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("progress"."user_id" = (select auth.uid())) WITH CHECK ("progress"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "Users can delete their own progress" ON "progress" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("progress"."user_id" = (select auth.uid()));