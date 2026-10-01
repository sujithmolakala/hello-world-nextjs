"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function ProfileForm({ userId }: { userId: string }) {
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [message, setMessage] = useState("");
    const router = useRouter();

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const supabase = createClient();

        const { data, error } = await supabase
            .from("profiles")
            .update({
                first_name: firstName,
                last_name: lastName,
            })
            .eq("id", userId)
            .select();

        if (error) {
            setMessage(error.message);
            return;
        }

        if (!data || data.length === 0) {
            setMessage("Profile was not updated.");
            return;
        }

        setMessage("Profile saved!");
        router.refresh();

        if (error) {
            setMessage(error.message);
            return;
        }

        setMessage("Profile saved!");
        router.refresh();
    };

    return (
        <section>
            <h2>Complete Your Profile</h2>
            <p>Please enter your first and last name.</p>

            <form onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="firstName">First name</label>
                    <br />
                    <input
                        id="firstName"
                        type="text"
                        value={firstName}
                        onChange={(event) => setFirstName(event.target.value)}
                        required
                    />
                </div>

                <div>
                    <label htmlFor="lastName">Last name</label>
                    <br />
                    <input
                        id="lastName"
                        type="text"
                        value={lastName}
                        onChange={(event) => setLastName(event.target.value)}
                        required
                    />
                </div>

                <button type="submit">Save Profile</button>
            </form>

            {message && <p>{message}</p>}
        </section>
    );
}