# frozen_string_literal: true

# The CMS writes an empty string when no optional cover image is selected.
# Liquid treats that string as true, so Chirpy renders a broken preview image.
Jekyll::Hooks.register :site, :post_read do |site|
  site.posts.docs.each do |post|
    image = post.data['image']
    post.data.delete('image') if image.is_a?(String) && image.strip.empty?
  end
end
