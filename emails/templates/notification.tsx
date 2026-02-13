export function NotificationTemplate({
  title,
  message,
  actionUrl,
  actionText,
}: {
  title: string
  message: string
  actionUrl: string
  actionText: string
}) {
  return `
    <h2>${title}</h2>
    <p>${message}</p>
    <p><a href="${actionUrl}">${actionText}</a></p>
  `
}
