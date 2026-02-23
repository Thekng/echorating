'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react'
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride'
import { getTourStepsForRole } from './tour-steps'

type TourContextType = {
    startTour: () => void
    hasSeenTour: boolean
}

const TourContext = createContext<TourContextType | undefined>(undefined)

export function useTour() {
    const context = useContext(TourContext)
    if (!context) {
        throw new Error('useTour must be used within a TourProvider')
    }
    return context
}

type TourProviderProps = {
    children: ReactNode
    userRole?: string
}

export function TourProvider({ children, userRole = 'member' }: TourProviderProps) {
    const [run, setRun] = useState(false)
    const [hasSeenTour, setHasSeenTour] = useState(true) // Default true to prevent flash
    const [isMounted, setIsMounted] = useState(false)

    const steps = useMemo(() => getTourStepsForRole(userRole), [userRole])

    useEffect(() => {
        setIsMounted(true)
        // Check local storage on mount
        const seen = localStorage.getItem('echorating_tour_seen')
        if (!seen) {
            setHasSeenTour(false)
            // Small delay to ensure DOM is fully painted including any Suspense boundaries
            const timer = setTimeout(() => {
                setRun(true)
            }, 1000)
            return () => clearTimeout(timer)
        }
    }, [])

    const startTour = () => {
        setRun(true)
    }

    const handleJoyrideCallback = (data: CallBackProps) => {
        const { status } = data
        if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
            // Tour completed or skipped
            setRun(false)
            setHasSeenTour(true)
            localStorage.setItem('echorating_tour_seen', 'true')
        }
    }

    return (
        <TourContext.Provider value={{ startTour, hasSeenTour }}>
            {children}
            {isMounted ? (
                <Joyride
                    steps={steps}
                    run={run}
                    continuous
                    showProgress
                    showSkipButton
                    callback={handleJoyrideCallback}
                    disableOverlayClose
                    spotlightPadding={4}
                    styles={{
                        options: {
                            primaryColor: 'hsl(var(--primary))',
                            textColor: 'hsl(var(--foreground))',
                            backgroundColor: 'hsl(var(--card))',
                            arrowColor: 'hsl(var(--card))',
                            overlayColor: 'rgba(0, 0, 0, 0.5)',
                        },
                        buttonNext: {
                            backgroundColor: 'hsl(var(--primary))',
                            color: 'hsl(var(--primary-foreground))',
                            borderRadius: 'var(--radius)',
                            padding: '8px 16px',
                            fontSize: '14px',
                            fontWeight: 500,
                        },
                        buttonBack: {
                            color: 'hsl(var(--muted-foreground))',
                            marginRight: '12px',
                        },
                        buttonSkip: {
                            color: 'hsl(var(--muted-foreground))',
                        }
                    }}
                />
            ) : null}
        </TourContext.Provider>
    )
}
