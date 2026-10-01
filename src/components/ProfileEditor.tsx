"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type ProfileEditorProps = {
    userId: string;
    initialFirstName: string;
    initialLastName: string;
    initialAvatarUrl: string;
};

export default function ProfileEditor({
                                          userId,
                                          initialFirstName,
                                          initialLastName,
                                          initialAvatarUrl,
                                      }: ProfileEditorProps) {
    const [firstName, setFirstName] = useState(initialFirstName);
    const [lastName, setLastName] = useState(initialLastName);
    const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
    const [photo, setPhoto] = useState<File | null>(null);
    const [message, setMessage] = useState("");
    const router = useRouter();

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const supabase = createClient();
        setMessage("Saving...");

        let newAvatarUrl = avatarUrl;

        // Upload a new profile photo if one was selected
        if (photo) {
            const fileExtension = photo.name.split(".").pop();
            const filePath = `${userId}/avatar.${fileExtension}`;

            const { error: uploadError } = await supabase.storage
                .from("avatars")
                .upload(filePath, photo, {
                    upsert: true,
                });

            if (uploadError) {
                setMessage(`Photo upload failed: ${uploadError.message}`);
                return;
            }

            const { data } = supabase.storage
                .from("avatars")
                .getPublicUrl(filePath);

            newAvatarUrl = `${data.publicUrl}?t=${Date.now()}`;
        }

        // Save profile information
        const { error } = await supabase
            .from("profiles")
            .update({
                first_name: firstName,
                last_name: lastName,
                avatar_url: newAvatarUrl || null,
            })
            .eq("id", userId);

        if (error) {
            setMessage(`Profile update failed: ${error.message}`);
            return;
        }

        setAvatarUrl(newAvatarUrl);
        setMessage("Profile updated!");
        router.refresh();
    };

    return (
        <section>
            {avatarUrl && (
                <div>
                    <p>Profile photo:</p>
                    <img
                        src={avatarUrl}
                        alt="Profile"
                        width={150}
                        height={150}
                        style={{
                            objectFit: "cover",
                            borderRadius: "50%",
                        }}
                    />
                </div>
            )}

            <form onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="profileFirstName">First name</label>
                    <br />
                    <input
                        id="profileFirstName"
                        type="text"
                        value={firstName}
                        onChange={(event) => setFirstName(event.target.value)}
                        required
                    />
                </div>

                <div>
                    <label htmlFor="profileLastName">Last name</label>
                    <br />
                    <input
                        id="profileLastName"
                        type="text"
                        value={lastName}
                        onChange={(event) => setLastName(event.target.value)}
                        required
                    />
                </div>

                <div>
                    <label htmlFor="profilePhoto">Profile photo</label>
                    <br />
                    <input
                        id="profilePhoto"
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp"
                        onChange={(event) =>
                            setPhoto(event.target.files?.[0] ?? null)
                        }
                    />
                </div>

                <br />

                <button type="submit">Save Changes</button>
            </form>

            {message && <p>{message}</p>}
        </section>
    );
}