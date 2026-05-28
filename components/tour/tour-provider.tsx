'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react'
import Joyride, { CallBackProps, STATUS } from 'react-joyride'
import { getTourStepsForRole } from './tour-steps'

type TourContextType = {
    startTour: () => void
    hasSeenTour: boolean
}

const TourContext = createContext<TourContextType | undefined>(undefined)

export const useTour = () => {
    const context = useContext(TourContext)
    if (!context) {
        throw new Error('useTour must be used within a TourProvider')
    }
    return context
}

interface TourProviderProps {
    children: ReactNode
    userRole: string
}

export const TourProvider = ({ children, userRole }: TourProviderProps) => {
    const [run, setRun] = useState(false)
    const [hasSeenTour, setHasSeenTour] = useState(true)
    const [isMounted, setIsMounted] = useState(false)

    const steps = useMemo(() => getTourStepsForRole(userRole), [userRole])

    /* eslint-disable react-hooks/set-state-in-effect */
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
    /* eslint-enable react-hooks/set-state-in-effect */

    const startTour = () => {
        setRun(true)
    }

    const handleJoyrideCallback = (data: CallBackProps) => {
        const { status } = data
        const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED]

        if (finishedStatuses.includes(status)) {
            setRun(false)
            setHasSeenTour(true)
            localStorage.setItem('echorating_tour_seen', 'true')
        }
    }

    return (
        <TourContext.Provider value={{ startTour, hasSeenTour }}>
            {isMounted && (
                <Joyride
                    steps={steps}
                    run={run}
                    continuous
                    showProgress
                    showSkipButton
                    callback={handleJoyrideCallback}
                    styles={{
                        options: {
                            primaryColor: '#0f172a',
                            zIndex: 1000,
                        },
                    }}
                />
            )}
            {children}
        </TourContext.Provider>
    )
}
