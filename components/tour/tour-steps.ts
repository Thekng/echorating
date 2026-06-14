import { Step } from 'react-joyride'

export function getTourStepsForRole(role: string): Step[] {
    const isManagerOrOwner = role === 'owner' || role === 'manager'

    const commonSteps: Step[] = [
        {
            target: 'body',
            placement: 'center',
            content: 'Welcome to Echorating! Let\'s take a quick tour to help you get the most out of our platform.',

        },
        {
            target: '.tour-nav-dashboard',
            content: 'The Dashboard gives you a high-level overview of performance across your teams and members.',

        },
        {
            target: '.tour-nav-daily-log',
            content: 'The Daily Log is where you input your daily stats. Stay consistent to keep your performance scores high!',

        },
        {
            target: '.tour-nav-team',
            content: 'View your team members, track submission consistency, and drill into individual agent performance.',

        },
    ]

    const adminSteps: Step[] = [
        {
            target: '.tour-nav-settings',
            content: 'As a manager, your Settings tab lets you configure Teams, invite Members, and define custom Stats & Goals.',

        },
    ]

    const endingStep: Step[] = [
        {
            target: '.tour-nav-user-menu',
            content: 'You can always update your profile, switch theme modes, or restart this tour from your account menu. You\'re all set!',

        },
    ]

    const steps = [...commonSteps]

    if (isManagerOrOwner) {
        steps.push(...adminSteps)
    }

    steps.push(...endingStep)

    return steps
}
