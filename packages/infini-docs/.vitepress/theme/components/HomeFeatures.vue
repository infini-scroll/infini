<script setup lang="ts">
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";

export interface HomeFeature {
    icon: IconDefinition;
    title: string;
    details: string;
    link?: string;
}

defineProps<{
    features: HomeFeature[];
}>();
</script>

<template>
    <section class="home-features" aria-label="Highlights">
        <component
            :is="feature.link ? 'a' : 'article'"
            v-for="feature in features"
            :key="feature.title"
            class="home-feature"
            :href="feature.link"
        >
            <span class="home-feature__icon" aria-hidden="true">
                <FontAwesomeIcon :icon="feature.icon" fixed-width />
            </span>
            <h2>{{ feature.title }}</h2>
            <p>{{ feature.details }}</p>
        </component>
    </section>
</template>

<style scoped>
.home-features {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
    margin: 0 0 64px;
}

.home-feature {
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding: 24px;
    border: 1px solid var(--vp-c-bg-soft);
    border-radius: 12px;
    color: inherit;
    text-decoration: none;
    background: var(--vp-c-bg-soft);
    transition:
        border-color 0.25s,
        background-color 0.25s;
}

.home-feature[href]:hover {
    border-color: var(--vp-c-brand-1);
}

.home-feature__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    margin-bottom: 20px;
    border-radius: 6px;
    color: var(--vp-c-brand-1);
    font-size: 24px;
    background: var(--vp-c-default-soft);
}

.home-feature h2 {
    margin: 0;
    padding: 0;
    border: 0;
    color: var(--vp-c-text-1);
    font-size: 16px;
    font-weight: 600;
    line-height: 24px;
    white-space: pre-line;
}

.home-feature p {
    flex-grow: 1;
    margin: 0;
    padding-top: 8px;
    color: var(--vp-c-text-2);
    font-size: 14px;
    font-weight: 500;
    line-height: 24px;
}

@media (max-width: 767px) {
    .home-features {
        grid-template-columns: 1fr;
    }
}
</style>
