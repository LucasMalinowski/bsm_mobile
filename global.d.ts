declare module '@expo/vector-icons' {
  export const Ionicons: any;
  export const MaterialIcons: any;
  export const FontAwesome: any;
}

declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

declare module '*.module.css' {
  const content: { [className: string]: string };
  export default content;
}
