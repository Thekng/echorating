import { Step } from 'react-joyride'

export function getTourStepsForRole(role: string): Step[] {
    const isManagerOrOwner = role === 'owner' || role === 'manager'

    const commonSteps: Step[] = [
        {
            target: 'body',
            placement: 'center',
            content: 'Welcome to Echorating! Let\'s take a quick tour to help you get the most out of our platform.',
            disableBeacon: true,
        },
        {
            target: '.tour-nav-dashboard',
            content: 'The Dashboard gives you a high-level overview of performance across your teams and members.',
            disableBeacon: true,
        },
        {
            target: '.tour-nav-daily-log',
            content: 'The Daily Log is where you input your daily stats. Stay consistent to keep your performance scores high!',
            disableBeacon: true,
        },
        {
            target: '.tour-nav-leaderboard',
            content: 'Check the Leaderboard to see how you rank against your peers, and celebrate top performers.',
            disableBeacon: true,
        },
        {
            target: '.tour-nav-accountability',
            content: 'Here you can view deep-dives into individual team member stats, tracking consistency and goal completion over time.',
            disableBeacon: true,
        },
    ]

    const adminSteps: Step[] = [
        {
            target: '.tour-nav-settings',
            content: 'As a manager, your Settings tab lets you configure Teams, invite Members, and define custom Stats & Goals.',
            disableBeacon: true,
        },
    ]

    const endingStep: Step[] = [
        {
            target: '.tour-nav-user-menu',
            content: 'You can always update your profile, switch theme modes, or restart this tour from your account menu. You\'re all set!',
            disableBeacon: true,
        },
    ]

    const steps = [...commonSteps]

    if (isManagerOrOwner) {
        steps.push(...adminSteps)
    }

    steps.push(...endingStep)

    return steps
}
