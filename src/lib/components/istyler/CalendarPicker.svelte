<script lang="ts">
    import * as Icon from "lucide-svelte";
    import { Calendar } from "bits-ui";
    import { CalendarDate, parseDate, type DateValue } from "@internationalized/date";
    import { strftime } from "$lib/utils";
    import {
        clampDateValue,
        type DateMode,
    } from "./dateValue";

    type CalendarMode = Extract<DateMode, "date" | "month" | "year">;
    type CalendarView = "days" | "months" | "years";

    export let value: string | null = null;
    export let min: string | null = null;
    export let max: string | null = null;
    export let mode: CalendarMode = "date";
    export let disabled = false;
    export let readonly = false;
    export let calendarLabel = "Sélection de date";
    export let close: () => void;
    export let onchange: (value: string) => void;

    const MONTHS = Array.from({ length: 12 }, (_, index) => ({
        value: index + 1,
        label: strftime(new Date(2000, index, 1), "%_B", "fr-FR"),
    }));
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    const pad = (part: number) => String(part).padStart(2, "0");
    const clamp = (candidate: number, minimum: number, maximum: number) =>
        Math.min(maximum, Math.max(minimum, candidate));

    let placeholder: DateValue = today();
    let calendarView: CalendarView = "days";
    let monthPanelYear = currentYear;
    let yearPanelStart = currentYear - 5;
    let syncedMode: CalendarMode | null = null;

    $: calendarValue = toCalendarDate(value, mode);
    $: calendarMin = toCalendarDate(min, mode);
    $: calendarMax = toCalendarDate(max, mode);
    $: selectedYear = value ? Number(value.slice(0, 4)) : null;
    $: selectedMonth = value && mode === "month" ? Number(value.slice(5, 7)) : null;
    $: viewYear = Number(placeholder.year) || currentYear;
    $: viewMonth = Number(placeholder.month) || currentMonth;
    $: minYear = min ? Number(min.slice(0, 4)) : null;
    $: maxYear = max ? Number(max.slice(0, 4)) : null;
    $: displayedYears = Array.from({ length: 12 }, (_, index) => yearPanelStart + index);
    $: if (mode !== syncedMode) {
        syncedMode = mode;
        syncView();
    }

    function today() {
        return new CalendarDate(currentYear, currentMonth, currentDate.getDate());
    }

    function toCalendarDate(raw: string | null, activeMode: CalendarMode) {
        if (!raw) return undefined;

        try {
            if (activeMode === "year") return parseDate(`${raw}-01-01`);
            if (activeMode === "month") return parseDate(`${raw}-01`);
            return parseDate(raw);
        } catch {
            return undefined;
        }
    }

    function syncView() {
        const fallback = clampDateValue(new Date(), min, max, mode);
        const nextDate = calendarValue ?? toCalendarDate(fallback, mode) ?? today();

        placeholder = nextDate;
        monthPanelYear = nextDate.year;
        yearPanelStart = clamp(nextDate.year - 5, 1, 9988);
        calendarView = mode === "month" ? "months" : mode === "year" ? "years" : "days";
    }

    function commit(nextValue: string) {
        onchange(nextValue);
        close();
    }

    function applyCalendarDate(date: DateValue | undefined) {
        if (date) commit(date.toString());
    }

    function openMonthPanel() {
        monthPanelYear = viewYear;
        calendarView = "months";
    }

    function openYearPanel() {
        yearPanelStart = clamp(viewYear - 5, 1, 9988);
        calendarView = "years";
    }

    function selectMonth(month: number) {
        if (mode === "month") {
            commit(`${monthPanelYear}-${pad(month)}`);
            return;
        }

        placeholder = new CalendarDate(monthPanelYear, month, 1);
        calendarView = "days";
    }

    function selectYear(year: number) {
        if (mode === "year") {
            commit(String(year));
            return;
        }

        placeholder = new CalendarDate(year, viewMonth, 1);
        monthPanelYear = year;
        calendarView = "days";
    }

    function changeMonthPanelYear(offset: number) {
        monthPanelYear = clamp(monthPanelYear + offset, 1, 9999);
    }

    function changeYearPage(offset: number) {
        yearPanelStart = clamp(yearPanelStart + offset, 1, 9988);
    }

    function isMonthDisabled(year: number, month: number) {
        const candidate = `${year}-${pad(month)}`;
        return Boolean((min && candidate < min.slice(0, 7)) || (max && candidate > max.slice(0, 7)));
    }

    function isYearDisabled(year: number) {
        return Boolean((minYear !== null && year < minYear) || (maxYear !== null && year > maxYear));
    }

    function canShowMonthYear(year: number) {
        return year >= 1
            && year <= 9999
            && (minYear === null || year >= minYear)
            && (maxYear === null || year <= maxYear);
    }

    function canShowYearPage(start: number) {
        return start >= 1
            && start <= 9988
            && (minYear === null || start + 11 >= minYear)
            && (maxYear === null || start <= maxYear);
    }
</script>

{#snippet monthPanel()}
    <div class="date-calendar-header">
        <button
            type="button"
            class="date-calendar-nav"
            aria-label="Année précédente"
            disabled={!canShowMonthYear(monthPanelYear - 1)}
            onclick={() => changeMonthPanelYear(-1)}
        >
            <Icon.ChevronLeft size={16} />
        </button>
        <span class="date-calendar-heading">{monthPanelYear}</span>
        <button
            type="button"
            class="date-calendar-nav"
            aria-label="Année suivante"
            disabled={!canShowMonthYear(monthPanelYear + 1)}
            onclick={() => changeMonthPanelYear(1)}
        >
            <Icon.ChevronRight size={16} />
        </button>
    </div>

    <div class="date-month-grid" role="group" aria-label={`Mois de l’année ${monthPanelYear}`}>
        {#each MONTHS as month}
            <button
                type="button"
                class="date-picker-cell"
                class:--selected={mode === "date"
                    ? viewYear === monthPanelYear && viewMonth === month.value
                    : selectedYear === monthPanelYear && selectedMonth === month.value}
                class:--current={currentYear === monthPanelYear && currentMonth === month.value}
                disabled={isMonthDisabled(monthPanelYear, month.value)}
                onclick={() => selectMonth(month.value)}
            >
                {month.label}
            </button>
        {/each}
    </div>
{/snippet}

{#snippet yearPanel()}
    <div class="date-calendar-header">
        <button
            type="button"
            class="date-calendar-nav"
            aria-label="Période précédente"
            disabled={!canShowYearPage(yearPanelStart - 12)}
            onclick={() => changeYearPage(-12)}
        >
            <Icon.ChevronLeft size={16} />
        </button>
        <span class="date-calendar-heading">{yearPanelStart} – {yearPanelStart + 11}</span>
        <button
            type="button"
            class="date-calendar-nav"
            aria-label="Période suivante"
            disabled={!canShowYearPage(yearPanelStart + 12)}
            onclick={() => changeYearPage(12)}
        >
            <Icon.ChevronRight size={16} />
        </button>
    </div>

    <div class="date-year-grid" role="group" aria-label="Années">
        {#each displayedYears as year (year)}
            <button
                type="button"
                class="date-picker-cell"
                class:--selected={mode === "date" ? viewYear === year : selectedYear === year}
                class:--current={currentYear === year}
                disabled={isYearDisabled(year)}
                onclick={() => selectYear(year)}
            >
                {year}
            </button>
        {/each}
    </div>
{/snippet}

{#if mode === "month"}
    {@render monthPanel()}
{:else if mode === "year"}
    {@render yearPanel()}
{:else}
    <Calendar.Root
        type="single"
        locale="fr-FR"
        weekdayFormat="short"
        weekStartsOn={1}
        fixedWeeks={true}
        preventDeselect={true}
        disableDaysOutsideMonth={false}
        value={calendarValue}
        bind:placeholder
        minValue={calendarMin}
        maxValue={calendarMax}
        {disabled}
        {readonly}
        {calendarLabel}
        initialFocus={true}
        onValueChange={applyCalendarDate}
    >
        {#snippet children({ months, weekdays })}
            {#if calendarView === "months"}
                {@render monthPanel()}
            {:else if calendarView === "years"}
                {@render yearPanel()}
            {:else}
                <Calendar.Header class="date-calendar-header">
                    <Calendar.PrevButton class="date-calendar-nav" aria-label="Mois précédent">
                        <Icon.ChevronLeft size={16} />
                    </Calendar.PrevButton>

                    <div class="date-heading-selects">
                        <button
                            type="button"
                            class="date-heading-select --month"
                            aria-label="Choisir le mois"
                            onclick={openMonthPanel}
                        >
                            {MONTHS[viewMonth - 1]?.label}
                        </button>
                        <button
                            type="button"
                            class="date-heading-select --year"
                            aria-label="Choisir l’année"
                            onclick={openYearPanel}
                        >
                            {viewYear}
                        </button>
                    </div>

                    <Calendar.NextButton class="date-calendar-nav" aria-label="Mois suivant">
                        <Icon.ChevronRight size={16} />
                    </Calendar.NextButton>
                </Calendar.Header>

                <div class="date-calendar-grid-frame">
                    {#each months as month (month.value.toString())}
                        <Calendar.Grid class="date-calendar-grid">
                            <Calendar.GridHead>
                                <Calendar.GridRow>
                                    {#each weekdays as weekday}
                                        <Calendar.HeadCell class="date-calendar-head-cell">
                                            {weekday}
                                        </Calendar.HeadCell>
                                    {/each}
                                </Calendar.GridRow>
                            </Calendar.GridHead>
                            <Calendar.GridBody>
                                {#each month.weeks as weekDates}
                                    <Calendar.GridRow>
                                        {#each weekDates as date}
                                            <Calendar.Cell {date} month={month.value} class="date-calendar-cell">
                                                <Calendar.Day class="date-calendar-day" />
                                            </Calendar.Cell>
                                        {/each}
                                    </Calendar.GridRow>
                                {/each}
                            </Calendar.GridBody>
                        </Calendar.Grid>
                    {/each}
                </div>
            {/if}
        {/snippet}
    </Calendar.Root>
{/if}
